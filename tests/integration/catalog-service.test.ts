import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset } from '@/domain/types';
import { CatalogService } from '@/services/catalog-service';

describe('Integration: CatalogService and Repository Resolution', () => {
  let service: CatalogService;

  beforeAll(async () => {
    const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
    service = CatalogService.getInstance();
    await service.initialize(dataset);
  });

  it('provides dataset summary metrics', async () => {
    const summary = await service.getSummary();
    expect(summary.vehiclesCount).toBeGreaterThan(1500);
    expect(summary.productsCount).toBeGreaterThan(400);
    expect(summary.applicationsCount).toBeGreaterThan(3000);
    expect(summary.sourcesCount).toBeGreaterThan(150);
  });

  it('lists automotive brands in alphabetical order and strictly contains only manufacturers', async () => {
    const brands = await service.getBrands();
    expect(brands.length).toBeGreaterThan(20);
    expect(brands).toContain('Chevrolet');
    expect(brands).toContain('Fiat');
    expect(brands).toContain('Volkswagen');
    expect(brands).toContain('Toyota');

    // Nenhuma medida em polegadas permitida
    expect(brands.some((b) => /\d/.test(b) || /["'”’]/.test(b))).toBe(false);

    // Nenhum modelo de carro permitido
    expect(brands).not.toContain('Caravan');
    expect(brands).not.toContain('Cerato');
    expect(brands).not.toContain('Cherokee');
    expect(brands).not.toContain('Chevette');
    expect(brands).not.toContain('Cobalt');
    expect(brands).not.toContain('Corsa Wagon');
    expect(brands).not.toContain('Escort');
    expect(brands).not.toContain('Etios/Sedan');
    expect(brands).not.toContain('Fielder');
    expect(brands).not.toContain('Fusca');
    expect(brands).not.toContain('Não informada');
  });

  it('lists models by brand', async () => {
    const models = await service.getModelsByBrand('Chevrolet');
    expect(models.length).toBeGreaterThan(0);
    const hasOnix = models.some((m) => m.toLowerCase().includes('onix'));
    expect(hasOnix).toBe(true);
  });

  it('resolves multi-manufacturer cross reference for Onix', async () => {
    const search = service.search('Onix 2019');
    const onix = search.find((r) => r.vehicle?.model.toLowerCase().includes('onix'));
    expect(onix).toBeDefined();

    const crossRef = await service.getVehicleCrossReference(onix!.vehicle!.id);
    expect(crossRef.length).toBeGreaterThan(0);

    const firstPos = crossRef[0]!;
    expect(firstPos.vehicleApplication.position).toBeDefined();
    expect(firstPos.vehicle.brand).toBeDefined();

    // Fabricantes presentes
    const mfrs = Object.keys(firstPos.productsByManufacturer);
    expect(mfrs.length).toBeGreaterThan(0);
  });

  it('resolves product by exact code and tracks official catalog source', async () => {
    const prod = await service.getProductByCode('SD6');
    expect(prod).toBeDefined();
    expect(prod?.code).toBe('SD6');
    expect(prod?.sourceIds.length).toBeGreaterThan(0);
  });
});
