import { describe, expect, it, beforeAll } from 'bun:test';
import { CatalogService } from '@/services/catalog-service';
import datasetRaw from '../../data/validated/dataset.json';
import type { CatalogDataset } from '@/domain/types';
import { formatVariantTechnicalSheet, formatFamilyTechnicalSheet } from '@/ui/components/VehicleFamilyCard';

describe('Fase 6: QA End-to-End, Hardening de Produção & Balcão', () => {
  let service: CatalogService;
  let dataset: CatalogDataset;

  beforeAll(async () => {
    dataset = datasetRaw as unknown as CatalogDataset;
    service = CatalogService.getInstance();
    await service.initialize(dataset);
  });

  // 1. NORMALIZAÇÃO, CARACTERES ESPECIAIS E BUSCA ROBUSTA
  describe('1. Normalização de Busca e Caracteres Especiais', () => {
    it('deve retornar exatamente a mesma família Hilux independentemente de caixa ou espaços', () => {
      const qLower = service.search('hilux');
      const qUpper = service.search('HILUX');
      const qMixed = service.search('Hilux');
      const qSpaces = service.search('   hilux   ');

      expect(qLower[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qUpper[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qMixed[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qSpaces[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qLower[0]?.family?.id).toBe(qUpper[0]?.family?.id);
    });

    it('deve reconhecer anos com diferentes delimitadores (espaço, hífen, barra)', () => {
      const qSpace = service.search('HILUX 2015');
      const qHyphen = service.search('HILUX-2015');
      const qSlash = service.search('HILUX/2015');

      expect(qSpace[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qHyphen[0]?.family?.fullName).toBe('Toyota Hilux');
      expect(qSlash[0]?.family?.fullName).toBe('Toyota Hilux');

      // Em todos os casos deve isolar a variante 2005 a 2015
      expect(qSpace[0]?.family?.variants.length).toBe(1);
      expect(qHyphen[0]?.family?.variants.length).toBe(1);
      expect(qSlash[0]?.family?.variants.length).toBe(1);
      expect(qSpace[0]?.family?.variants[0]?.label).toContain('2005');
    });

    it('deve lidar com consultas vazias sem lançar erro', () => {
      const empty = service.search('');
      const spaces = service.search('     ');

      expect(empty.length).toBeGreaterThan(0);
      expect(spaces.length).toBeGreaterThan(0);
      expect(empty.length).toBe(spaces.length);
    });

    it('deve buscar corretamente veículos com modelos compostos e acentuação', () => {
      const c4 = service.search('C4 Picasso');
      expect(c4.length).toBeGreaterThan(0);
      const c4Found = c4.some((r) => r.family?.fullName.includes('C4 Picasso') || r.vehicle?.model.includes('C4 Picasso'));
      expect(c4Found).toBe(true);

      const p208 = service.search('Peugeot 208');
      expect(p208.length).toBeGreaterThan(0);
      expect(p208[0]?.family?.fullName).toContain('208');
    });
  });

  // 2. ZERO SURPRESAS & ISOLAMENTO DE FAMÍLIAS
  describe('2. Teste de "Zero Surpresas" e Isolamento de Famílias', () => {
    it('HILUX: traz Toyota Hilux sem embutir Hilux SW4', () => {
      const res = service.search('HILUX');
      expect(res[0]?.family?.fullName).toBe('Toyota Hilux');
      const hasSw4 = res[0]?.family?.variants.some((v) => v.label.toUpperCase().includes('SW4'));
      expect(hasSw4).toBe(false);
    });

    it('SW4: traz Toyota Hilux SW4 isolada com suas próprias variantes', () => {
      const res = service.search('SW4');
      expect(res[0]?.family?.fullName).toBe('Toyota Hilux SW4');
      expect(res[0]?.family?.variants.length).toBeGreaterThan(0);
    });

    it('ONIX: traz Chevrolet Onix e desacopla Onix Plus (com relatedFamilies)', () => {
      const res = service.search('ONIX');
      expect(res[0]?.family?.fullName).toBe('Chevrolet Onix');
      expect(res[0]?.family?.relatedFamilies).toContain('Onix Plus');
      const hasPlusInVariants = res[0]?.family?.variants.some((v) => v.label.toUpperCase().includes('PLUS'));
      expect(hasPlusInVariants).toBe(false);
    });

    it('ONIX PLUS: traz Chevrolet Onix Plus exclusivamente', () => {
      const res = service.search('ONIX PLUS');
      expect(res[0]?.family?.fullName).toBe('Chevrolet Onix Plus');
      expect(res[0]?.family?.relatedFamilies).toContain('Onix');
    });

    it('COROLLA: traz Toyota Corolla sem incorporar Corolla Cross nem Corolla Fielder', () => {
      const res = service.search('COROLLA');
      expect(res[0]?.family?.fullName).toBe('Toyota Corolla');
      expect(res[0]?.family?.relatedFamilies).toContain('Corolla Cross');
      expect(res[0]?.family?.relatedFamilies).toContain('Corolla Fielder');
    });

    it('HB20: traz Hyundai HB20 sem incorporar HB20S', () => {
      const res = service.search('HB20');
      expect(res[0]?.family?.fullName.toLowerCase()).toBe('hyundai hb20');
      expect(res[0]?.family?.relatedFamilies).toContain('HB20S');
      const hasHB20S = res[0]?.family?.variants.some((v) => v.label.toUpperCase().includes('HB20S'));
      expect(hasHB20S).toBe(false);
    });
  });

  // 3. FILTRO POR ANO & ELIMINAÇÃO DE VARIANTES INCOMPATÍVEIS
  describe('3. Filtro por Ano e Eliminação de Variantes', () => {
    it('HILUX 2015: elimina variantes 2016+ e mantém apenas 2005-2015', () => {
      const res = service.search('HILUX 2015');
      const family = res[0]?.family!;
      expect(family.variants.length).toBe(1);
      const v = family.variants[0]!;
      expect(v.yearStart).toBeLessThanOrEqual(2015);
      expect(v.yearEnd).toBeGreaterThanOrEqual(2015);
    });

    it('HILUX 2016: mantém as variantes de 2016+ (Padrão e Cabine) e elimina 2005-2015', () => {
      const res = service.search('HILUX 2016');
      const family = res[0]?.family!;
      expect(family.variants.length).toBe(2);
      for (const v of family.variants) {
        expect(v.yearStart).toBeLessThanOrEqual(2016);
      }
    });

    it('COROLLA 2020: mantém apenas as variantes que cobrem o ano 2020', () => {
      const res = service.search('COROLLA 2020');
      const family = res[0]?.family!;
      for (const v of family.variants) {
        expect(v.yearStart).toBeLessThanOrEqual(2020);
        if (v.yearEnd !== null) {
          expect(v.yearEnd).toBeGreaterThanOrEqual(2020);
        }
      }
    });

    it('HB20 2020: mantém apenas a geração que cobre o ano 2020', () => {
      const res = service.search('HB20 2020');
      const family = res[0]?.family!;
      for (const v of family.variants) {
        expect(v.yearStart).toBeLessThanOrEqual(2020);
        if (v.yearEnd !== null) {
          expect(v.yearEnd).toBeGreaterThanOrEqual(2020);
        }
      }
    });
  });

  // 4. FILTROS COMBINADOS (EQUIVALÊNCIA COM BUSCA TEXTUAL)
  describe('4. Equivalência de Filtros Combinados com Busca Textual', () => {
    it('Toyota + Hilux + 2015 produz o mesmo resultado de HILUX 2015', () => {
      const textual = service.search('HILUX 2015');
      const structured = service.search('', { brand: 'Toyota', model: 'Hilux', year: 2015 });

      expect(textual[0]?.family?.fullName).toBe(structured[0]?.family?.fullName);
      expect(textual[0]?.family?.variants.length).toBe(structured[0]?.family?.variants.length);
      expect(textual[0]?.family?.variants[0]?.label).toBe(structured[0]?.family?.variants[0]?.label);
    });

    it('Chevrolet + Onix + 2020 não vaza Onix Plus', () => {
      const res = service.search('', { brand: 'Chevrolet', model: 'Onix', year: 2020 });
      expect(res[0]?.family?.fullName).toBe('Chevrolet Onix');
      expect(res[0]?.family?.fullName).not.toContain('Plus');
    });
  });

  // 5. TESTE DE POSIÇÃO E INTEGRIDADE
  describe('5. Teste de Posições e Ausência de Blocos Vazios', () => {
    it('não gera aplicações sem medidas válidas ou posições vazias', () => {
      const res = service.search('HILUX');
      const family = res[0]?.family!;
      for (const variant of family.variants) {
        expect(variant.applications.length).toBeGreaterThan(0);
        for (const app of variant.applications) {
          expect(app.position).toBeDefined();
          expect(['motorista', 'passageiro', 'par_dianteiro', 'traseira']).toContain(app.position);
          expect(app.inches !== null || app.sizeLabel !== null).toBe(true);
          expect(app.fits.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // 6. DIVERGÊNCIA DOCUMENTAL DE BALCÃO
  describe('6. Teste de Divergência Documental', () => {
    it('Tracker 2020+ documenta divergência de medida (24" vs 26") com aviso claro de balcão', () => {
      const res = service.search('TRACKER');
      const tracker = res.find((r) => r.family?.fullName.includes('Tracker'))?.family;
      expect(tracker).toBeDefined();
      expect(tracker!.governance?.documentaryDivergencesCount).toBeGreaterThan(0);
      expect(tracker!.governance?.divergenceDetails?.length).toBeGreaterThan(0);

      const div = tracker!.governance?.divergenceDetails?.[0];
      expect(div?.warningMessage).toContain('medidas documentadas');
      expect(div?.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 7. APLICAÇÃO MULTI-CATÁLOGO CONFIRMADA
  describe('7. Teste de Aplicação Multi-Catálogo', () => {
    it('Corolla 2014-2019 motorista 26" possui confirmação multi-catálogo em 3 marcas (DYNA, CINOY, VETOR)', () => {
      const res = service.search('COROLLA 2015');
      const v = res[0]?.family?.variants[0]!;
      const driver = v.applications.find((a) => a.position === 'motorista');
      expect(driver).toBeDefined();
      expect(driver!.inches).toBe(26);
      const brandSet = new Set(driver!.fits.map((f) => f.manufacturerCode.toUpperCase()));
      expect(brandSet.size).toBe(3);
      expect(brandSet.has('DYNA')).toBe(true);
      expect(brandSet.has('CINOY')).toBe(true);
      expect(brandSet.has('VETOR')).toBe(true);
      expect(driver!.technicalStatus).toBe('MULTI_CATALOG_CONFIRMED');
    });
  });

  // 8. BUSCA POR PRODUTOS E PRODUTOS ÓRFÃOS
  describe('8. Busca por Produtos e Produtos Órfãos', () => {
    it('busca por códigos SD6, YN-PS2416B e PS2416B retorna produtos sem contaminação por veículo', () => {
      const sd6 = service.search('SD6');
      expect(sd6.length).toBe(1);
      expect(sd6[0]?.type).toBe('product');
      expect(sd6[0]?.product?.code).toBe('SD6');

      const yn = service.search('YN-PS2416B');
      expect(yn.length).toBe(1);
      expect(yn[0]?.type).toBe('product');
      expect(yn[0]?.product?.code).toBe('YN-PS2416B');

      const ps = service.search('PS2416B');
      expect(ps.length).toBe(1);
      expect(ps[0]?.type).toBe('product');
      expect(ps[0]?.product?.code).toBe('YN-PS2416B');
    });

    it('produtos sem fits veiculares diretos (órfãos/universais) são apresentados como produto sem aplicação veicular direta', () => {
      const fitProductIds = new Set(dataset.fits.map((f) => f.brandProductId));
      const orphans = dataset.products.filter((p) => !fitProductIds.has(p.id));
      expect(orphans.length).toBeGreaterThan(0);

      const orphanSample = orphans[0]!;
      const searchRes = service.search(orphanSample.code);
      expect(searchRes.length).toBeGreaterThan(0);
      expect(searchRes[0]?.type).toBe('product');
      expect(searchRes[0]?.product?.id).toBe(orphanSample.id);
    });
  });

  // 9. FORMATAÇÃO DO TEXTO PARA WHATSAPP / BALCÃO (SEÇÃO 12)
  describe('9. Formatação da Ficha Técnica para Copiar / WhatsApp', () => {
    it('formata a variante Hilux 2005-2015 no padrão estrito de balcão', () => {
      const res = service.search('HILUX 2015');
      const family = res[0]?.family!;
      const variant = family.variants[0]!;

      const text = formatVariantTechnicalSheet(family, variant, true);

      expect(text).toContain('Toyota Hilux');
      expect(text).toContain('Ano: 2005 → 2015');
      expect(text).toContain('Dianteira');
      expect(text).toContain('Motorista: 21"');
      expect(text).toContain('Passageiro: 19"');
      expect(text).toContain('VETOR:');

      // Não deve conter lixo técnico ou IDs internos
      expect(text).not.toContain('P0');
      expect(text).not.toContain('P1');
      expect(text).not.toContain('classification');
      expect(text).not.toContain('priority');
      expect(text).not.toContain('vehicleApplicationId');
      expect(text).not.toContain('brandProductId');
    });

    it('inclui aviso de divergência documental quando houver divergência real', () => {
      const res = service.search('TRACKER');
      const tracker = res.find((r) => r.family?.fullName.includes('Tracker'))?.family!;
      const text = formatFamilyTechnicalSheet(tracker);

      expect(text).toContain('Atenção: existem medidas divergentes entre catálogos.');
    });
  });

  // 10. ESTRESSE E MEMÓRIA
  describe('10. Estresse e Performance Contínua', () => {
    it('executa 100 buscas consecutivas mantendo tempo médio inferior a 15ms', () => {
      const queries = ['HILUX', 'ONIX', 'COROLLA', 'HB20', 'GOL', 'SW4', 'SD6', 'TRACKER'];
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const q = queries[i % queries.length]!;
        const start = performance.now();
        const res = service.search(q);
        const elapsed = performance.now() - start;
        times.push(elapsed);
        expect(res.length).toBeGreaterThan(0);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avg).toBeLessThan(15);
    });
  });
});
