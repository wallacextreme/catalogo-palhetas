import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset, VehicleFamilyResult } from '@/domain/types';
import { CatalogService } from '@/services/catalog-service';

describe('Phase 5 Integration: Balcão UI Governance Use Cases (Seção 22)', () => {
  let service: CatalogService;

  beforeAll(async () => {
    const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
    service = CatalogService.getInstance();
    await service.initialize(dataset);
  });

  it('1. Caso HILUX: Valida confirmação multi-catálogo e aplicações por carroceria no balcão', () => {
    const results = service.search('HILUX');
    const hilux = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(hilux).toBeDefined();
    expect(hilux.family.fullName).toBe('Toyota Hilux');

    // Governança de família derivada estritamente dos dados
    const gov = hilux.family.governance;
    expect(gov).toBeDefined();
    expect(gov!.confirmedCatalogsCount).toBeGreaterThanOrEqual(2);
    expect(gov!.confirmedCatalogsList).toContain('CINOY');
    expect(gov!.confirmedCatalogsList).toContain('VETOR');
    expect(gov!.hasBodyVariants).toBe(true);
    expect(gov!.badgeSummaryText).toContain('catálogos');
    expect(gov!.badgeSummaryText).toContain('Aplicações por carroceria');

    // Descoberta assistida
    expect(hilux.family.relatedFamilies).toContain('SW4');
  });

  it('2. Caso HILUX 2015: Filtro de ano seleciona estritamente variante 2005-2015 confirmada', () => {
    const results = service.search('HILUX 2015');
    const hilux = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(hilux).toBeDefined();
    expect(hilux.family.variants.length).toBe(1);

    const v2015 = hilux.family.variants[0]!;
    expect(v2015.yearStart).toBe(2005);
    expect(v2015.yearEnd).toBe(2015);

    // Motorista 21" confirmado em múltiplos catálogos
    const driver = v2015.applications.find((a) => a.position === 'motorista')!;
    expect(driver.inches).toBe(21);
    expect(driver.fits.length).toBeGreaterThanOrEqual(2);
  });

  it('3. Caso TRACKER: Detecta divergência documental de balcão (DYNA vs VETOR/CINOY)', () => {
    const results = service.search('TRACKER');
    const tracker = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(tracker).toBeDefined();
    expect(tracker.family.fullName).toBe('Chevrolet Tracker');

    const gov = tracker.family.governance;
    expect(gov).toBeDefined();
    expect(gov!.documentaryDivergencesCount).toBeGreaterThanOrEqual(1);
    expect(gov!.requiresSpecialAttention).toBe(true);
    expect(gov!.badgeSummaryText).toContain('divergência documental');

    // Mensagem de aviso de balcão transparente sem jargão interno
    const div = gov!.divergenceDetails[0]!;
    expect(div.warningMessage).toContain('Atenção: há duas medidas documentadas para esta aplicação');
    expect(div.warningMessage).toContain('Confirme a peça instalada ou o catálogo desejado no balcão');
  });

  it('4. Caso ONIX: Desacoplamento de Onix Plus e pílula de modelos relacionados', () => {
    const results = service.search('ONIX');
    const onix = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(onix).toBeDefined();
    expect(onix.family.fullName).toBe('Chevrolet Onix');
    expect(onix.family.relatedFamilies).toContain('Onix Plus');

    // Nenhuma variante do Onix Plus incorporada
    const hasPlus = onix.family.variants.some((v) => v.vehicle.model.toLowerCase().includes('plus'));
    expect(hasPlus).toBe(false);
  });

  it('5. Caso COROLLA: Desacoplamento de Corolla Cross e Corolla Fielder', () => {
    const results = service.search('COROLLA');
    const corolla = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(corolla).toBeDefined();
    expect(corolla.family.fullName).toBe('Toyota Corolla');
    expect(corolla.family.relatedFamilies).toContain('Corolla Cross');
    expect(corolla.family.relatedFamilies).toContain('Corolla Fielder');

    const hasCross = corolla.family.variants.some((v) => v.vehicle.model.toLowerCase().includes('cross'));
    const hasFielder = corolla.family.variants.some((v) => v.vehicle.model.toLowerCase().includes('fielder'));
    expect(hasCross).toBe(false);
    expect(hasFielder).toBe(false);
  });

  it('6. Caso HB20: Desacoplamento estrito de HB20S', () => {
    const results = service.search('HB20');
    const hb20 = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(hb20).toBeDefined();
    expect(hb20.family.fullName).toBe('Hyundai Hb20');
    expect(hb20.family.relatedFamilies).toContain('HB20S');

    const hasHb20s = hb20.family.variants.some((v) => v.vehicle.model.toLowerCase().includes('hb20s'));
    expect(hasHb20s).toBe(false);
  });

  it('7. Caso SW4: Isolamento absoluto de Hilux SW4 como família própria', () => {
    const results = service.search('SW4');
    const sw4 = results.find((r) => r.type === 'vehicle_family') as { family: VehicleFamilyResult };
    expect(sw4).toBeDefined();
    expect(sw4.family.fullName).toContain('SW4');
  });
});
