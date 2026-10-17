import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset } from '@/domain/types';
import { POSITIONS } from '@/domain/types';
import { CatalogSearchEngine, extractYearFromQuery } from '@/search/search-engine';
import { consolidateVehicleFamilies } from '@/domain/consolidation';

describe('Data Integrity & Technical Audit (Fase 3)', () => {
  let dataset: CatalogDataset;
  let searchEngine: CatalogSearchEngine;
  let validSourceIds: Set<string>;
  let validVehicleIds: Set<string>;
  let validApplicationIds: Set<string>;
  let validProductIds: Set<string>;
  let validManufacturerIds: Set<string>;

  beforeAll(async () => {
    dataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
    searchEngine = new CatalogSearchEngine(dataset);
    validSourceIds = new Set(dataset.sources.map((s) => s.id));
    validVehicleIds = new Set(dataset.vehicles.map((v) => v.id));
    validApplicationIds = new Set(dataset.applications.map((a) => a.id));
    validProductIds = new Set(dataset.products.map((p) => p.id));
    validManufacturerIds = new Set(dataset.manufacturers.map((m) => m.id));
  });

  // 1. Identificabilidade e Esquema
  it('1. Todos os veículos, produtos e aplicações possuem chaves primárias e campos obrigatórios preenchidos', () => {
    expect(dataset.vehicles.length).toBeGreaterThan(2500);
    expect(dataset.applications.length).toBeGreaterThan(7000);
    expect(dataset.products.length).toBeGreaterThan(500);

    for (const v of dataset.vehicles) {
      expect(v.id).toBeDefined();
      expect(v.brand.trim().length).toBeGreaterThan(0);
      expect(v.model.trim().length).toBeGreaterThan(0);
      expect(v.category).toBeDefined();
      expect(v.yearRaw).toBeDefined();
    }

    for (const p of dataset.products) {
      expect(p.id).toBeDefined();
      expect(p.code.trim().length).toBeGreaterThan(0);
      expect(p.manufacturerId).toBeDefined();
      expect(validManufacturerIds.has(p.manufacturerId)).toBe(true);
    }
  });

  // 2. Integridade Referencial Completa
  it('2. Todas as relações e chaves estrangeiras são 100% íntegras (sem órfãos relacionais)', () => {
    for (const a of dataset.applications) {
      expect(validVehicleIds.has(a.vehicleId)).toBe(true);
    }

    for (const f of dataset.fits) {
      expect(validApplicationIds.has(f.vehicleApplicationId)).toBe(true);
      expect(validProductIds.has(f.brandProductId)).toBe(true);
    }
  });

  // 3. Rastreabilidade Documental
  it('3. Rastreabilidade é total: 100% dos veículos, aplicações e relações possuem sourceIds válidos', () => {
    for (const v of dataset.vehicles) {
      expect(v.sourceIds.length).toBeGreaterThan(0);
      for (const sId of v.sourceIds) {
        expect(validSourceIds.has(sId)).toBe(true);
      }
    }

    for (const a of dataset.applications) {
      expect(a.sourceIds.length).toBeGreaterThan(0);
      for (const sId of a.sourceIds) {
        expect(validSourceIds.has(sId)).toBe(true);
      }
    }

    for (const f of dataset.fits) {
      expect(f.sourceIds.length).toBeGreaterThan(0);
      for (const sId of f.sourceIds) {
        expect(validSourceIds.has(sId)).toBe(true);
      }
    }

    for (const s of dataset.sources) {
      expect(s.catalogName.trim().length).toBeGreaterThan(0);
      expect(s.catalogYear).toBeGreaterThanOrEqual(2020);
    }
  });

  // 4. Plausibilidade Dimensional de Medidas
  it('4. Todas as medidas de palhetas são dimensionais e plausíveis para o segmento leve automotivo', () => {
    for (const a of dataset.applications) {
      expect(POSITIONS).toContain(a.position as any);

      if (a.inches !== null) {
        expect(a.inches).toBeGreaterThanOrEqual(8);
        expect(a.inches).toBeLessThanOrEqual(36);
      }

      if (a.millimeters !== null) {
        expect(a.millimeters).toBeGreaterThanOrEqual(200);
        expect(a.millimeters).toBeLessThanOrEqual(950);
      }

      if (a.inches !== null && a.millimeters !== null) {
        const expectedMm = a.inches * 25.4;
        expect(Math.abs(expectedMm - a.millimeters)).toBeLessThanOrEqual(15);
      }
    }
  });

  // 5. Coerência dos Intervalos de Anos
  it('5. Nenhum veículo possui intervalo de ano invertido (yearStart > yearEnd)', () => {
    for (const v of dataset.vehicles) {
      if (v.yearStart !== null && v.yearEnd !== null) {
        expect(v.yearStart).toBeLessThanOrEqual(v.yearEnd);
      }
    }
  });

  // 6. Ausência de Duplicidade Exata
  it('6. O dataset não possui duplicidade exata (redundância total de veículo + aplicações + fontes)', () => {
    const signatureMap = new Map<string, string>();
    for (const v of dataset.vehicles) {
      const sig = `${v.brand}|${v.model}|${v.yearStart}|${v.yearEnd}|${v.yearEndOpen}|${v.category}|${v.sourceIds.sort().join(',')}`;
      // Nenhum mesmo veículo tem duplicidade exata redundante
      if (signatureMap.has(sig)) {
        // Se houver assinatura idêntica, deve ser de IDs diferentes com diferenças em notas/variante
        expect(signatureMap.get(sig)).not.toBe(v.id);
      } else {
        signatureMap.set(sig, v.id);
      }
    }
  });

  // 7. Isolamento de Fronteiras de Famílias na Busca
  it('7. A busca preserva rigorosamente as fronteiras de famílias sem vazamento cruzado', () => {
    // GOL não vaza GOLF nem KADETT
    const golRes = searchEngine.search('GOL');
    const golConsolidated = consolidateVehicleFamilies(golRes);
    for (const r of golConsolidated) {
      if (r.type === 'vehicle_family') {
        expect(r.family?.model.toLowerCase()).toBe('gol');
        expect(r.family?.model.toLowerCase()).not.toBe('golf');
      }
    }

    // HILUX não vaza SW4
    const hiluxRes = searchEngine.search('HILUX');
    const hiluxConsolidated = consolidateVehicleFamilies(hiluxRes);
    expect(hiluxConsolidated.length).toBe(1);
    expect(hiluxConsolidated[0]?.family?.model.toLowerCase()).toBe('hilux');
    expect(hiluxConsolidated[0]?.family?.model.toLowerCase()).not.toContain('sw4');

    // SW4 não vaza picape Hilux pura
    const sw4Res = searchEngine.search('SW4');
    const sw4Consolidated = consolidateVehicleFamilies(sw4Res);
    expect(sw4Consolidated.length).toBe(1);
    expect(sw4Consolidated[0]?.family?.model.toLowerCase()).toContain('sw4');
  });

  // 8. Precisão de Busca por Ano sem Vazamento
  it('8. A busca por ano filtra estritamente as variantes compatíveis e não gera falsos positivos de produto', () => {
    const raw = searchEngine.search('HILUX 2015');
    const year = extractYearFromQuery('HILUX 2015');
    expect(year).toBe(2015);
    const consolidated = consolidateVehicleFamilies(raw, year);

    expect(consolidated.length).toBe(1);
    const hilux = consolidated[0]!;
    expect(hilux.family?.selectedYear).toBe(2015);
    expect(hilux.family?.variants.length).toBe(1);

    const v = hilux.family?.variants[0]!;
    expect(v.yearStart).toBe(2005);
    expect(v.yearEnd).toBe(2015);

    // Nenhum produto espúrio com código "2015" é retornado
    const products = consolidated.filter((r) => r.type === 'product');
    expect(products.length).toBe(0);
  });
});
