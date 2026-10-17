import type {
  BrandProduct,
  CatalogDataset,
  CatalogSource,
  RelationType,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';
import { CatalogSearchEngine, extractYearFromQuery, type SearchFilters, type SearchResultItem } from '@/search/search-engine';
import { InMemoryCatalogDatabase } from '@/repositories/memory/memory-repository';
import { DexieCatalogRepository } from '@/repositories/dexie/dexie-database';
import { consolidateVehicleFamilies } from '@/domain/consolidation';

export class CatalogService {
  private static instance: CatalogService | null = null;
  private dataset: CatalogDataset | null = null;
  private searchEngine: CatalogSearchEngine | null = null;
  private memoryDb = new InMemoryCatalogDatabase();
  private dexieDb = new DexieCatalogRepository();
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  /**
   * Inicializa o catálogo. Em ambiente browser, tenta carregar do IndexedDB
   * ou busca `/data/dataset.json` (que fica cacheado pelo Service Worker / PWA).
   */
  public async initialize(customDataset?: CatalogDataset): Promise<void> {
    if (this.isLoaded && !customDataset) return;

    if (customDataset) {
      this.dataset = customDataset;
    } else if (typeof window !== 'undefined' && 'fetch' in window) {
      try {
        const baseUrl = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
        const dataUrl = `${baseUrl}/data/dataset.json`;
        const resp = await fetch(dataUrl, { cache: 'no-cache' });
        if (!resp.ok) throw new Error(`Falha ao carregar dataset: HTTP ${resp.status}`);
        this.dataset = (await resp.json()) as CatalogDataset;
        // Atualiza o IndexedDB com a versão oficial limpa mais recente
        this.dexieDb.loadDataset(this.dataset).catch((err) => {
          console.warn('Erro ao atualizar IndexedDB:', err);
        });
      } catch (err) {
        console.warn('Falha no fetch direto, tentando carregar do IndexedDB offline:', err);
        const count = await this.dexieDb.countVehicles();
        if (count > 0) {
          this.dataset = await this.dexieDb.exportDataset();
        }
      }
    }

    if (!this.dataset) {
      throw new Error('Dataset de palhetas não pôde ser carregado.');
    }

    await this.memoryDb.loadDataset(this.dataset);
    this.searchEngine = new CatalogSearchEngine(this.dataset);
    this.isLoaded = true;
  }

  public getDataset(): CatalogDataset {
    if (!this.dataset) throw new Error('Catálogo não foi inicializado.');
    return this.dataset;
  }

  public search(query: string, filters?: SearchFilters): SearchResultItem[] {
    if (!this.searchEngine) throw new Error('Engine de busca não inicializada.');
    const raw = this.searchEngine.search(query, filters);
    const filterYear = filters?.year ?? extractYearFromQuery(query);
    return consolidateVehicleFamilies(raw, filterYear);
  }

  public async getBrands(): Promise<string[]> {
    return this.memoryDb.listBrands();
  }

  public async getModelsByBrand(brand?: string): Promise<string[]> {
    return this.memoryDb.listModelsByBrand(brand);
  }

  public async getProductByCode(code: string): Promise<BrandProduct | null> {
    return this.memoryDb.getProductByCode(code);
  }

  public async getVehicleById(id: string): Promise<Vehicle | null> {
    return this.memoryDb.getVehicleById(id);
  }

  public async getVehicleCrossReference(vehicleId: string) {
    return this.memoryDb.resolveForVehicle(vehicleId);
  }

  public getSummary() {
    return this.memoryDb.getDatasetSummary();
  }

  public async getProductApplications(productId: string): Promise<Array<{
    vehicle: Vehicle;
    application: VehicleApplication;
    relationType: RelationType | 'catalog_documented';
  }>> {
    const fits = await this.memoryDb.getFitsByProductId(productId);
    const results: Array<{
      vehicle: Vehicle;
      application: VehicleApplication;
      relationType: RelationType | 'catalog_documented';
    }> = [];

    const seen = new Set<string>();
    for (const fit of fits) {
      const app = await this.memoryDb.getApplicationById(fit.vehicleApplicationId);
      if (!app) continue;
      const vehicle = await this.memoryDb.getVehicleById(app.vehicleId);
      if (!vehicle) continue;
      const key = `${vehicle.id}-${app.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        vehicle,
        application: app,
        relationType: fit.relationType,
      });
    }
    return results;
  }

  public async getSourcesByIds(ids: string[]): Promise<CatalogSource[]> {
    return this.memoryDb.getManySourcesByIds(ids);
  }

  public getManufacturerName(manufacturerId: string): string {
    const m = this.memoryDb.getManufacturerById(manufacturerId);
    return m?.code || m?.name || manufacturerId;
  }

  public getEquivalentProductsForProduct(productId: string): Record<string, BrandProduct[]> {
    if (!this.searchEngine) return {};
    return this.searchEngine.getEquivalentProductsForProduct(productId);
  }
}
