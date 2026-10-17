import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset } from '@/domain/types';
import { CatalogSearchEngine, extractYearFromQuery, type SearchResultItem } from '@/search/search-engine';
import { consolidateVehicleFamilies, consolidateVehicleResults } from '@/domain/consolidation';

describe('Search Engine: Technical Queries and Fuzzy Matching', () => {
  let searchEngine: CatalogSearchEngine;
  let dataset: CatalogDataset;

  beforeAll(async () => {
    dataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
    searchEngine = new CatalogSearchEngine(dataset);
  });

  it('finds Chevrolet Onix by exact model name', () => {
    const results = searchEngine.search('Onix');
    expect(results.length).toBeGreaterThan(0);
    const hasOnix = results.some((r) => r.vehicle?.model.toLowerCase().includes('onix'));
    expect(hasOnix).toBe(true);
  });

  it('finds Onix with year query "Onix 2019"', () => {
    const results = searchEngine.search('Onix 2019');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0]!;
    const brand = top.vehicle?.brand.toLowerCase() ?? '';
    expect(brand.includes('chevrolet') || brand.includes('general motors')).toBe(true);
    expect(top.vehicle?.model.toLowerCase()).toContain('onix');
  });

  it('finds product by exact code "YN-PS2416B"', () => {
    const results = searchEngine.search('YN-PS2416B');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.product?.code).toBe('YN-PS2416B');
  });

  it('finds product by normalized lower-case code "yn-ps2416b"', () => {
    const results = searchEngine.search('yn-ps2416b');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.product?.code).toBe('YN-PS2416B');
  });

  it('finds product by compact partial code "ps2416b"', () => {
    const results = searchEngine.search('ps2416b');
    expect(results.length).toBeGreaterThan(0);
    const match = results.find((r) => r.product?.code === 'YN-PS2416B');
    expect(match).toBeDefined();
  });

  it('finds Dyna specific wiper "SD6"', () => {
    const results = searchEngine.search('SD6');
    expect(results.length).toBeGreaterThan(0);
    const match = results.find((r) => r.product?.code === 'SD6');
    expect(match).toBeDefined();
  });

  it('applies combined filters correctly (Brand + Year)', () => {
    const results = searchEngine.search('Tracker', {
      brand: 'Chevrolet',
      year: 2018,
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      if (r.vehicle) {
        expect(r.vehicle.brand.toLowerCase()).toContain('chevrolet');
      }
    }
  });

  it('returns applications with correct position, sizes and source tracking', () => {
    const results = searchEngine.search('Onix 2019');
    const onix = results.find((r) => r.vehicle?.model.toLowerCase().includes('onix'));
    expect(onix).toBeDefined();
    expect(onix?.matchedApplications).toBeDefined();
    expect(onix?.matchedApplications?.length).toBeGreaterThan(0);

    const firstApp = onix?.matchedApplications?.[0];
    expect(firstApp?.application.position).toBeDefined();
    expect(firstApp?.fits.length).toBeGreaterThan(0);

    const firstFit = firstApp?.fits[0];
    expect(firstFit?.product).toBeDefined();
    expect(firstFit?.sources.length).toBeGreaterThan(0);
    expect(firstFit?.sources[0]?.catalogYear).toBeDefined();
  });

  it('decouples car models and searches only the specific car searched (e.g. Etios without Hilux/SW4)', () => {
    const results = searchEngine.search('Etios');
    expect(results.length).toBeGreaterThan(0);

    for (const r of results) {
      if (r.vehicle) {
        expect(r.vehicle.model.toLowerCase()).toContain('etios');
        expect(r.vehicle.model.toLowerCase()).not.toContain('hilux');
        expect(r.vehicle.model.toLowerCase()).not.toContain('sw4');
      }
    }
  });

  it('consolidates redundant records of the same car into a single unified card with all positions', () => {
    const rawResults = searchEngine.search('Etios');
    const { consolidateVehicleResults } = require('@/domain/consolidation');
    const consolidated = consolidateVehicleResults(rawResults);

    // Deve resultar em exatamente 1 veículo consolidado para o Etios
    expect(consolidated.length).toBe(1);

    const etios = consolidated[0]!;
    expect(etios.vehicle?.brand).toBe('Toyota');
    expect(etios.vehicle?.model.toLowerCase()).toContain('etios');

    // Deve conter todas as posições unificadas (motorista, passageiro, par, traseira)
    const positions = etios.matchedApplications?.map((a: any) => a.application.position);
    expect(positions).toContain('motorista');
    expect(positions).toContain('traseira');

    // Verifica que palhetas de diferentes fabricantes estão reunidas na mesma visão
    const allFits = etios.matchedApplications?.flatMap((a: any) => a.fits) || [];
    const brands = new Set(allFits.map((f: any) => f.manufacturerCode));
    expect(brands.has('DYNA')).toBe(true);
    expect(brands.has('CINOY')).toBe(true);
    expect(brands.has('VETOR')).toBe(true);
  });

  it('decouples HILUX search completely from COROLLA and consolidates engine variants', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleResults(rawResults);

    // Deve retornar apenas veículos Hilux / SW4, NUNCA Corolla
    for (const item of consolidated) {
      if (item.type === 'vehicle' && item.vehicle) {
        const m = item.vehicle.model.toLowerCase();
        expect(m.includes('hilux') || m.includes('sw4')).toBe(true);
        expect(m.includes('corolla')).toBe(false);
      }
    }

    // Deve consolidar para menos de 6 quadros essenciais (em vez de 18+)
    expect(consolidated.length).toBeLessThanOrEqual(6);
  });

  it('decouples GOL search completely from GOLF, KADETT GL, and GL 4MATIC', () => {
    const rawResults = searchEngine.search('GOL');
    const consolidated = consolidateVehicleResults(rawResults);

    // Nenhum resultado de veículo deve ser GOLF, KADETT GL ou GL
    for (const item of consolidated) {
      if (item.type === 'vehicle' && item.vehicle) {
        const m = item.vehicle.model.toLowerCase();
        expect(m.startsWith('gol')).toBe(true);
        expect(m.startsWith('golf')).toBe(false);
        expect(m.includes('kadett')).toBe(false);
      }
    }

    // Deve consolidar para menos de 6 quadros essenciais (em vez de 50+)
    expect(consolidated.length).toBeLessThanOrEqual(5);
  });

  it('filters specifically by model (e.g. HILUX) when main search query is empty', () => {
    const rawResults = searchEngine.search('', { model: 'HILUX' });
    expect(rawResults.length).toBeGreaterThan(0);

    for (const item of rawResults) {
      if (item.type === 'vehicle' && item.vehicle) {
        expect(item.vehicle.model.toLowerCase()).toContain('hilux');
        expect(item.vehicle.model.toLowerCase()).not.toContain('corolla');
      }
    }

    const consolidated = consolidateVehicleResults(rawResults);
    expect(consolidated.length).toBeGreaterThan(0);
    expect(consolidated.length).toBeLessThanOrEqual(6);
  });

  it('combines Brand and Model filters when main search query is empty', () => {
    const rawResults = searchEngine.search('', { brand: 'Toyota', model: 'Hilux' });
    expect(rawResults.length).toBeGreaterThan(0);

    for (const item of rawResults) {
      if (item.type === 'vehicle' && item.vehicle) {
        expect(item.vehicle.brand.toLowerCase()).toBe('toyota');
        expect(item.vehicle.model.toLowerCase()).toContain('hilux');
      }
    }
  });
});

describe('Vehicle Family & Technical Variants Architecture (Domain & Search)', () => {
  let searchEngine: CatalogSearchEngine;
  let dataset: CatalogDataset;

  beforeAll(async () => {
    dataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
    searchEngine = new CatalogSearchEngine(dataset);
  });

  // Teste 1: search("HILUX") deve retornar uma família visual de Hilux, não vários cartões equivalentes
  it('Teste 1: search("HILUX") returns a unified Toyota Hilux family result rather than multiple scattered cards', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hiluxFamilyItem = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.brand.toLowerCase() === 'toyota' && r.family?.model.toLowerCase() === 'hilux',
    );
    expect(hiluxFamilyItem).toBeDefined();
    expect(hiluxFamilyItem?.family?.fullName).toBe('Toyota Hilux');
  });

  // Teste 2: A família deve conter múltiplas variantes quando existirem faixas técnicas distintas
  it('Teste 2: The Hilux family contains multiple distinct technical variants corresponding to real year ranges', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hiluxFamilyItem = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.brand.toLowerCase() === 'toyota' && r.family?.model.toLowerCase() === 'hilux',
    );
    expect(hiluxFamilyItem).toBeDefined();
    const variants = hiluxFamilyItem?.family?.variants || [];

    // Hilux documentada no dataset possui 4 variantes técnicas distintas: 1993-2004, 2005-2015, 2016+, 2016-2025 Cabine
    expect(variants.length).toBeGreaterThanOrEqual(3);

    // Verifica que faixas distintas de anos existem separadamente
    const yearStarts = variants.map((v: any) => v.yearStart);
    expect(yearStarts).toContain(1993);
    expect(yearStarts).toContain(2005);
    expect(yearStarts).toContain(2016);
  });

  // Teste 3: Duas variantes com anos diferentes e produtos diferentes não podem ser mescladas em uma única aplicação
  it('Teste 3: Two variants with different years and different products are never merged into a single application', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hiluxFamilyItem = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux',
    );
    const variants = hiluxFamilyItem?.family?.variants || [];

    const var1993 = variants.find((v: any) => v.yearStart === 1993);
    const var2005 = variants.find((v: any) => v.yearStart === 2005);

    expect(var1993).toBeDefined();
    expect(var2005).toBeDefined();
    expect(var1993?.id).not.toBe(var2005?.id);

    // Na faixa 1993-2004 a palheta do motorista é 16", na 2005-2015 é 21"
    const driverApp1993 = var1993?.applications.find((a: any) => a.position === 'motorista');
    const driverApp2005 = var2005?.applications.find((a: any) => a.position === 'motorista');
    expect(driverApp1993?.inches).toBe(16);
    expect(driverApp2005?.inches).toBe(21);
  });

  // Teste 4: Duas aplicações da mesma posição com medidas diferentes devem permanecer separadas quando tecnicamente diferentes
  it('Teste 4: Two applications of the same position with different measures remain separate when technically different (e.g. 24" vs 26")', () => {
    const { areVehiclesSameTechnicalVariant } = require('@/domain/consolidation');

    const itemA: any = {
      type: 'vehicle',
      vehicle: { id: 'v1', brand: 'Toyota', model: 'Hilux', yearStart: 2005, yearEnd: 2011, yearRaw: '05/11', category: 'passeio', sourceIds: [] },
      matchedApplications: [
        {
          application: { id: 'a1', vehicleId: 'v1', position: 'motorista', inches: 24, millimeters: 609.6 },
          fits: [],
        },
      ],
    };

    const itemB: any = {
      type: 'vehicle',
      vehicle: { id: 'v2', brand: 'Toyota', model: 'Hilux', yearStart: 2012, yearEnd: 2015, yearRaw: '12/15', category: 'passeio', sourceIds: [] },
      matchedApplications: [
        {
          application: { id: 'a2', vehicleId: 'v2', position: 'motorista', inches: 26, millimeters: 660.4 },
          fits: [],
        },
      ],
    };

    // areVehiclesSameTechnicalVariant deve retornar FALSE pois as medidas divergem (24" vs 26")
    const isSame = areVehiclesSameTechnicalVariant(itemA, itemB);
    expect(isSame).toBe(false);
  });

  // Teste 5: Não criar faixa artificial de anos
  it('Teste 5: Does not create artificial year ranges across discontinuous intervals', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hilux = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux',
    );
    const variants = hilux?.family?.variants || [];

    // Não deve existir uma variante fundida artificial "1993 → 2025"
    const hasArtificialRange = variants.some((v: any) => v.yearStart === 1993 && v.yearEnd === 2025);
    expect(hasArtificialRange).toBe(false);
  });

  // Teste 6: HILUX 2015 deve selecionar somente a variante que cobre 2015
  it('Teste 6: HILUX 2015 selects ONLY the technical variant applicable to 2015', () => {
    const rawResults = searchEngine.search('HILUX 2015');
    const consolidated = consolidateVehicleFamilies(rawResults, 2015);

    const hilux = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux',
    );
    expect(hilux).toBeDefined();

    const variants = hilux?.family?.variants || [];
    // Hilux para 2015 deve ter apenas a variante 2005-2015
    expect(variants.length).toBe(1);
    expect(variants[0]?.yearStart).toBe(2005);
    expect(variants[0]?.yearEnd).toBe(2015);

    // Motorista 21", Passageiro 19"
    const driver = variants[0]?.applications.find((a: any) => a.position === 'motorista');
    const passenger = variants[0]?.applications.find((a: any) => a.position === 'passageiro');
    expect(driver?.inches).toBe(21);
    expect(passenger?.inches).toBe(19);
  });

  // Teste 7: Toyota + Hilux + 2015 deve produzir o mesmo comportamento
  it('Teste 7: Filter brand Toyota + model Hilux + year 2015 produces identical single variant result', () => {
    const rawResults = searchEngine.search('', { brand: 'Toyota', model: 'Hilux', year: 2015 });
    const consolidated = consolidateVehicleFamilies(rawResults, 2015);

    expect(consolidated.length).toBe(1);
    const hilux = consolidated[0]!;
    expect(hilux.family?.fullName).toBe('Toyota Hilux');
    expect(hilux.family?.variants.length).toBe(1);
    expect(hilux.family?.variants[0]?.yearStart).toBe(2005);
    expect(hilux.family?.variants[0]?.yearEnd).toBe(2015);
  });

  // Teste 8: SW4 não pode ser incorporada à família visual da Hilux
  it('Teste 8: SW4 is preserved as a separate family and is never merged into the Hilux family', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hiluxFamily = consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux',
    );
    expect(hiluxFamily).toBeDefined();

    // A família Hilux NÃO deve ter em suas variantes o modelo Hilux SW4
    for (const v of hiluxFamily?.family?.variants || []) {
      expect(v.vehicle.model.toLowerCase()).not.toContain('sw4');
    }

    // A busca por SW4 retorna SW4
    const sw4Results = searchEngine.search('SW4');
    const sw4Consolidated = consolidateVehicleFamilies(sw4Results);
    const sw4Family = sw4Consolidated.find(
      (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase().includes('sw4'),
    );
    expect(sw4Family).toBeDefined();
  });

  // Teste 9: Etios continua isolado
  it('Teste 9: Etios remains isolated from Hilux/SW4 and consolidates into 1 clean family', () => {
    const rawResults = searchEngine.search('Etios');
    const consolidated = consolidateVehicleFamilies(rawResults);

    expect(consolidated.length).toBe(1);
    const etios = consolidated[0]!;
    expect(etios.family?.brand).toBe('Toyota');
    expect(etios.family?.model.toLowerCase()).toBe('etios');
    expect(etios.family?.fullName).toBe('Toyota Etios');

    // Não contém nenhuma aplicação de Hilux ou SW4
    for (const v of etios.family?.variants || []) {
      expect(v.vehicle.model.toLowerCase()).not.toContain('hilux');
      expect(v.vehicle.model.toLowerCase()).not.toContain('sw4');
    }
  });

  // Teste 10: GOL continua isolado de GOLF, KADETT, GL
  it('Teste 10: GOL remains isolated from GOLF, KADETT, GL, and unifies its generations', () => {
    const rawResults = searchEngine.search('GOL');
    const consolidated = consolidateVehicleFamilies(rawResults);

    for (const item of consolidated) {
      if (item.type === 'vehicle_family' && item.family) {
        expect(item.family.model.toLowerCase()).toBe('gol');
        expect(item.family.model.toLowerCase()).not.toBe('golf');
        expect(item.family.model.toLowerCase()).not.toContain('kadett');
      }
    }

    const golFamily = consolidated.find((r: any) => r.family?.model.toLowerCase() === 'gol');
    expect(golFamily).toBeDefined();
    expect(golFamily?.family?.brand).toBe('Volkswagen');
    // Todas as gerações (G1..G7) estão presentes nas variantes técnicas
    expect(golFamily?.family?.variants.length).toBeGreaterThan(1);
  });

  // Teste 11: Busca por código continua funcionando
  it('Teste 11: Product code search (SD6, YN-PS2416B, ps2416b) continues returning product results', () => {
    const dynaRes = searchEngine.search('SD6');
    const cinoyRes = searchEngine.search('YN-PS2416B');
    const compactRes = searchEngine.search('ps2416b');

    expect(dynaRes[0]?.type).toBe('product');
    expect(dynaRes[0]?.product?.code).toBe('SD6');

    expect(cinoyRes[0]?.type).toBe('product');
    expect(cinoyRes[0]?.product?.code).toBe('YN-PS2416B');

    const compactMatch = compactRes.find((r) => r.product?.code === 'YN-PS2416B');
    expect(compactMatch).toBeDefined();
    expect(compactMatch?.type).toBe('product');
  });

  // Teste 12: Todas as fontes e sourceIds continuam presentes
  it('Teste 12: All sources and sourceIds remain preserved in variants and applications', () => {
    const rawResults = searchEngine.search('HILUX');
    const consolidated = consolidateVehicleFamilies(rawResults);

    const hilux = consolidated.find((r: any) => r.family?.model.toLowerCase() === 'hilux');
    expect(hilux?.family?.sourceIds.length).toBeGreaterThan(0);

    for (const v of hilux?.family?.variants || []) {
      expect(v.sourceIds.length).toBeGreaterThan(0);
      for (const app of v.applications) {
        for (const fit of app.fits) {
          expect(fit.sources.length).toBeGreaterThan(0);
          expect(fit.sources[0]?.catalogYear).toBeDefined();
          expect(fit.sources[0]?.catalogName).toBeDefined();
        }
      }
    }
  });

  // =========================================================================
  // FASE 2: TESTES DE REFINAMENTO (UX, VARIANTES, ANOS, SEPARAÇÃO TÉCNICA)
  // =========================================================================
  describe('Fase 2 Refinement: UX, Anos, Variantes e Separação Técnica', () => {
    it('Refinement 1: Busca HILUX ampla retorna 1 família Hilux com variantes técnicas distintas documentadas', () => {
      const raw = searchEngine.search('HILUX');
      const consolidated = consolidateVehicleFamilies(raw);

      expect(consolidated.length).toBe(1);
      const hilux = consolidated[0]!;
      expect(hilux.family?.brand).toBe('Toyota');
      expect(hilux.family?.fullName).toBe('Toyota Hilux');
      expect(hilux.family?.variants.length).toBe(4);
      
      // Contém variantes técnicas cobrindo os ciclos documentados
      const labels = hilux.family?.variants.map((v: any) => v.label);
      expect(labels?.some((l: string) => l.includes('2016'))).toBe(true);
      expect(labels?.some((l: string) => l.includes('2005'))).toBe(true);
    });

    it('Refinement 2: Busca HILUX 2015 retorna estritamente a aplicação 2005 → 2015 (sem variantes incompatíveis)', () => {
      const raw = searchEngine.search('HILUX 2015');
      const year = extractYearFromQuery('HILUX 2015');
      expect(year).toBe(2015);
      const consolidated = consolidateVehicleFamilies(raw, year);

      expect(consolidated.length).toBe(1);
      const hilux = consolidated[0]!;
      expect(hilux.family?.brand).toBe('Toyota');
      expect(hilux.family?.selectedYear).toBe(2015);
      expect(hilux.family?.variants.length).toBe(1);

      const variant = hilux?.family?.variants[0]!;
      expect(variant.yearStart).toBe(2005);
      expect(variant.yearEnd).toBe(2015);
      
      // Medidas da Hilux 2015: Motorista 21", Passageiro 19"
      const driver = variant.applications.find((a: any) => a.position === 'motorista');
      const passenger = variant.applications.find((a: any) => a.position === 'passageiro');
      expect(driver?.inches).toBe(21);
      expect(passenger?.inches).toBe(19);
    });

    it('Refinement 3: Busca HILUX 2016 preserva tanto a aplicação Padrão quanto a Carroceria Cabine separadas', () => {
      const raw = searchEngine.search('HILUX 2016');
      const year = extractYearFromQuery('HILUX 2016');
      expect(year).toBe(2016);
      const consolidated = consolidateVehicleFamilies(raw, year);

      const hilux = consolidated.find((r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux');
      expect(hilux).toBeDefined();
      expect(hilux?.family?.selectedYear).toBe(2016);

      // Deve ter exatamente as 2 aplicações que cobrem 2016: padrão (22"/22") e cabine (22"/16")
      expect(hilux?.family?.variants.length).toBe(2);

      const cabineVariant = hilux?.family?.variants.find((v: any) => v.variant === 'Cabine' || v.bodyTypeBadge?.includes('Cabine'));
      const padraoVariant = hilux?.family?.variants.find((v: any) => !v.variant || v.bodyTypeBadge === 'Aplicação Padrão');

      expect(cabineVariant).toBeDefined();
      expect(padraoVariant).toBeDefined();

      // Cabine tem motorista 22" e passageiro 16"
      const cabinePass = cabineVariant?.applications.find((a: any) => a.position === 'passageiro');
      expect(cabinePass?.inches).toBe(16);

      // Padrão tem motorista 22" e passageiro 22"
      const padraoPass = padraoVariant?.applications.find((a: any) => a.position === 'passageiro');
      expect(padraoPass?.inches).toBe(22);
    });

    it('Refinement 4: SW4 é mantida estritamente como família separada e não se mistura com a Hilux picape', () => {
      const raw = searchEngine.search('SW4');
      const consolidated = consolidateVehicleFamilies(raw);

      const sw4Family = consolidated.find(
        (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase().includes('sw4'),
      );
      expect(sw4Family).toBeDefined();
      expect(sw4Family?.family?.fullName).toContain('SW4');

      // A busca SW4 não deve retornar a picape pura como família principal
      const pureHilux = consolidated.find(
        (r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux',
      );
      expect(pureHilux).toBeUndefined();
    });

    it('Refinement 5: Filtro combinado Marca = Toyota, Modelo = Hilux, Ano = 2015 produz aplicação compatível', () => {
      const raw = searchEngine.search('', { brand: 'Toyota', model: 'Hilux', year: 2015 });
      const consolidated = consolidateVehicleFamilies(raw, 2015);

      const hilux = consolidated.find((r: any) => r.type === 'vehicle_family' && r.family?.model.toLowerCase() === 'hilux');
      expect(hilux).toBeDefined();
      expect(hilux?.family?.selectedYear).toBe(2015);
      expect(hilux?.family?.variants.length).toBe(1);

      const v = hilux?.family?.variants[0]!;
      expect(v.yearStart).toBe(2005);
      expect(v.yearEnd).toBe(2015);
    });

    it('Refinement 6: Valida que buscas de produto SD6 e YN-PS2416B continuam intactas e não são convertidas em veículos', () => {
      const sd6Res = searchEngine.search('SD6');
      expect(sd6Res.length).toBeGreaterThan(0);
      expect(sd6Res[0]?.type).toBe('product');
      expect(sd6Res[0]?.product?.code).toBe('SD6');

      const cinoyRes = searchEngine.search('YN-PS2416B');
      expect(cinoyRes.length).toBeGreaterThan(0);
      expect(cinoyRes[0]?.type).toBe('product');
      expect(cinoyRes[0]?.product?.code).toBe('YN-PS2416B');
    });
  });

  describe('Phase 4: Busca Inteligente por Família, Tokens e Hierarquia de Relevância (Partes 11-24)', () => {
    it('1. ONIX prioriza estritamente Chevrolet Onix e desacopla Onix Plus (com relatedFamilies)', () => {
      const raw = searchEngine.search('ONIX');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);

      const onix = families[0]!;
      expect(onix.family?.brand.toLowerCase()).toContain('chevrolet');
      expect(onix.family?.model).toBe('Onix');
      expect(onix.family?.fullName).toBe('Chevrolet Onix');

      // Verifica descoberta assistida sem poluição (Parte 13)
      expect(onix.family?.relatedFamilies).toBeDefined();
      expect(onix.family?.relatedFamilies).toContain('Onix Plus');

      // Nenhuma aplicação do Onix Plus está misturada no card do Onix
      const hasPlusInVariants = onix.family?.variants.some((v: any) =>
        v.vehicle.model.toLowerCase().includes('plus'),
      );
      expect(hasPlusInVariants).toBe(false);
    });

    it('2. ONIX PLUS encontra estritamente Chevrolet Onix Plus e não traz Chevrolet Onix', () => {
      const raw = searchEngine.search('ONIX PLUS');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);

      const onixPlus = families[0]!;
      expect(onixPlus.family?.model).toBe('Onix Plus');
      expect(onixPlus.family?.fullName).toBe('Chevrolet Onix Plus');
      expect(onixPlus.score).toBeGreaterThan(200); // explicit_variant intent score
    });

    it('3. COROLLA prioriza Toyota Corolla e isola Corolla Cross e Corolla Fielder', () => {
      const raw = searchEngine.search('COROLLA');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);

      const corolla = families[0]!;
      expect(corolla.family?.fullName).toBe('Toyota Corolla');
      expect(corolla.family?.relatedFamilies).toContain('Corolla Cross');
      expect(corolla.family?.relatedFamilies).toContain('Corolla Fielder');

      // Não há variantes Cross ou Fielder dentro de Corolla
      const hasCross = corolla.family?.variants.some((v: any) => v.vehicle.model.toLowerCase().includes('cross'));
      const hasFielder = corolla.family?.variants.some((v: any) => v.vehicle.model.toLowerCase().includes('fielder'));
      expect(hasCross).toBe(false);
      expect(hasFielder).toBe(false);
    });

    it('4. COROLLA CROSS encontra estritamente Toyota Corolla Cross', () => {
      const raw = searchEngine.search('COROLLA CROSS');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);
      expect(families[0]?.family?.fullName).toBe('Toyota Corolla Cross');
    });

    it('5. COROLLA FIELDER encontra estritamente Toyota Corolla Fielder', () => {
      const raw = searchEngine.search('COROLLA FIELDER');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);
      expect(families[0]?.family?.fullName).toBe('Toyota Corolla Fielder');
    });

    it('6. HB20 encontra estritamente Hyundai HB20 e não incorpora HB20S', () => {
      const raw = searchEngine.search('HB20');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);

      const hb20 = families[0]!;
      expect(hb20.family?.fullName).toBe('Hyundai Hb20');
      expect(hb20.family?.relatedFamilies).toContain('HB20S');

      const hasHb20s = hb20.family?.variants.some((v: any) => v.vehicle.model.toLowerCase().includes('hb20s'));
      expect(hasHb20s).toBe(false);
    });

    it('7. HB20S encontra estritamente Hyundai HB20S Sedan', () => {
      const raw = searchEngine.search('HB20S');
      const consolidated = consolidateVehicleFamilies(raw);

      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(families.length).toBe(1);
      expect(families[0]?.family?.fullName).toBe('Hyundai Hb20s');
    });

    it('8. GOL desacoplado de GOLF, e GOLF desacoplado de GOL', () => {
      const golRaw = searchEngine.search('GOL');
      const golFamilies = consolidateVehicleFamilies(golRaw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(golFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'golf')).toBe(false);
      expect(golFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'gol')).toBe(true);

      const golfRaw = searchEngine.search('GOLF');
      const golfFamilies = consolidateVehicleFamilies(golfRaw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(golfFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'gol')).toBe(false);
      expect(golfFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase().includes('golf'))).toBe(true);
    });

    it('9. KA desacoplado de KADETT, e KADETT desacoplado de KA', () => {
      const kaRaw = searchEngine.search('KA');
      const kaFamilies = consolidateVehicleFamilies(kaRaw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(kaFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'kadett')).toBe(false);
      expect(kaFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'ka')).toBe(true);

      const kadettRaw = searchEngine.search('KADETT');
      const kadettFamilies = consolidateVehicleFamilies(kadettRaw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(kadettFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'ka')).toBe(false);
      expect(kadettFamilies.some((f: SearchResultItem) => f.family?.model.toLowerCase() === 'kadett')).toBe(true);
    });

    it('10. HILUX e SW4 mantêm separação completa sem regressão', () => {
      const hiluxRaw = searchEngine.search('HILUX');
      const hiluxFamilies = consolidateVehicleFamilies(hiluxRaw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(hiluxFamilies.length).toBe(1);
      expect(hiluxFamilies[0]?.family?.model.toLowerCase()).toBe('hilux');

      const sw4Raw = searchEngine.search('SW4');
      const sw4Families = consolidateVehicleFamilies(sw4Raw).filter((r: SearchResultItem) => r.type === 'vehicle_family');
      expect(sw4Families.length).toBe(1);
      expect(sw4Families[0]?.family?.model.toLowerCase()).toContain('sw4');
    });

    it('11. Filtros Combinados: Marca = Chevrolet, Modelo = Onix, Ano = 2020 não vaza Onix Plus (Parte 17)', () => {
      const filtered = searchEngine.search('', {
        brand: 'Chevrolet',
        model: 'Onix',
        year: 2020,
      });
      const consolidated = consolidateVehicleFamilies(filtered, 2020);
      const families = consolidated.filter((r: SearchResultItem) => r.type === 'vehicle_family');

      expect(families.length).toBe(1);
      expect(families[0]?.family?.fullName).toBe('Chevrolet Onix');

      for (const item of filtered) {
        if (item.vehicle) {
          expect(item.vehicle.model.toLowerCase()).not.toContain('plus');
        }
      }
    });

    it('12. Hierarquia de Intenção e Relevância: exact_family domina resultados parciais (Parte 16)', () => {
      const results = searchEngine.search('Onix');
      expect(results.length).toBeGreaterThan(0);
      const top = results[0]!;
      expect(top.matchLevel).toBe('exact_family');
      expect(top.score).toBeGreaterThanOrEqual(100);

      const explicitResults = searchEngine.search('Onix Plus');
      expect(explicitResults.length).toBeGreaterThan(0);
      const topExplicit = explicitResults[0]!;
      expect(topExplicit.matchLevel).toBe('explicit_variant');
      expect(topExplicit.score).toBeGreaterThanOrEqual(110);
    });

    it('13. Performance de busca é inferior a 50ms para consultas fundamentais (Parte 31 e 32)', () => {
      for (const q of ['HILUX', 'ONIX', 'COROLLA', 'HB20', 'GOL']) {
        const t0 = performance.now();
        const r = searchEngine.search(q);
        const cons = consolidateVehicleFamilies(r);
        const duration = performance.now() - t0;
        expect(duration).toBeLessThan(50);
        expect(cons.length).toBeGreaterThan(0);
      }
    });

    it('14. Fase 5: Validação exaustiva de isolamento, variantes técnicas e filtros de ano (13 modelos)', () => {
      // 1. ONIX
      const onix = consolidateVehicleFamilies(searchEngine.search('ONIX')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(onix.family?.model).toBe('Onix');
      expect(onix.family?.relatedFamilies).toContain('Onix Plus');

      // 2. ONIX PLUS
      const onixPlus = consolidateVehicleFamilies(searchEngine.search('ONIX PLUS')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(onixPlus.family?.model).toBe('Onix Plus');

      // 3. COROLLA
      const corolla = consolidateVehicleFamilies(searchEngine.search('COROLLA')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(corolla.family?.model).toBe('Corolla');
      expect(corolla.family?.relatedFamilies).toContain('Corolla Cross');
      expect(corolla.family?.relatedFamilies).toContain('Corolla Fielder');

      // 4. COROLLA CROSS
      const corollaCross = consolidateVehicleFamilies(searchEngine.search('COROLLA CROSS')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(corollaCross.family?.model).toBe('Corolla Cross');

      // 5. COROLLA FIELDER
      const corollaFielder = consolidateVehicleFamilies(searchEngine.search('COROLLA FIELDER')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(corollaFielder.family?.model).toBe('Corolla Fielder');

      // 6. HB20
      const hb20 = consolidateVehicleFamilies(searchEngine.search('HB20')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(hb20.family?.model).toBe('Hb20');
      expect(hb20.family?.relatedFamilies).toContain('HB20S');

      // 7. HB20S
      const hb20s = consolidateVehicleFamilies(searchEngine.search('HB20S')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(hb20s.family?.model).toBe('Hb20s');

      // 8. HILUX
      const hilux = consolidateVehicleFamilies(searchEngine.search('HILUX')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(hilux.family?.model).toBe('Hilux');
      expect(hilux.family?.relatedFamilies).toContain('SW4');

      // 9. SW4
      const sw4 = consolidateVehicleFamilies(searchEngine.search('SW4')).filter(r => r.type === 'vehicle_family')[0]!;
      expect(sw4.family?.model.toLowerCase()).toContain('sw4');

      // 10. GOL
      const gol = consolidateVehicleFamilies(searchEngine.search('GOL')).filter(r => r.type === 'vehicle_family');
      expect(gol.some(g => g.family?.model.toLowerCase() === 'gol')).toBe(true);
      expect(gol.some(g => g.family?.model.toLowerCase() === 'golf')).toBe(false);

      // 11. GOLF
      const golf = consolidateVehicleFamilies(searchEngine.search('GOLF')).filter(r => r.type === 'vehicle_family');
      expect(golf.some(g => g.family?.model.toLowerCase().includes('golf'))).toBe(true);
      expect(golf.some(g => g.family?.model.toLowerCase() === 'gol')).toBe(false);

      // 12. KA
      const ka = consolidateVehicleFamilies(searchEngine.search('KA')).filter(r => r.type === 'vehicle_family');
      expect(ka.some(k => k.family?.model.toLowerCase() === 'ka')).toBe(true);
      expect(ka.some(k => k.family?.model.toLowerCase() === 'kadett')).toBe(false);

      // 13. KADETT
      const kadett = consolidateVehicleFamilies(searchEngine.search('KADETT')).filter(r => r.type === 'vehicle_family');
      expect(kadett.some(k => k.family?.model.toLowerCase() === 'kadett')).toBe(true);
      expect(kadett.some(k => k.family?.model.toLowerCase() === 'ka')).toBe(false);

      // Teste com Filtro de Ano e Variantes Técnicas
      const hilux2015 = consolidateVehicleFamilies(searchEngine.search('HILUX 2015'), 2015);
      expect(hilux2015.length).toBe(1);
      expect(hilux2015[0]?.family?.variants.length).toBe(1);
      expect(hilux2015[0]?.family?.variants[0]?.yearStart).toBe(2005);
      expect(hilux2015[0]?.family?.variants[0]?.yearEnd).toBe(2015);

      const corolla2020 = consolidateVehicleFamilies(searchEngine.search('COROLLA 2020'), 2020);
      expect(corolla2020.length).toBe(1);
      expect(corolla2020[0]?.family?.fullName).toBe('Toyota Corolla');
    });
  });
});
