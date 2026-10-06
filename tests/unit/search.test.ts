import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset } from '@/domain/types';
import { CatalogSearchEngine } from '@/search/search-engine';
import { consolidateVehicleResults } from '@/domain/consolidation';

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
