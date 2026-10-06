import Dexie, { type EntityTable } from 'dexie';
import type {
  BrandProduct,
  Catalog,
  CatalogDataset,
  CatalogSource,
  Connector,
  ConnectorEquivalence,
  ImportRecord,
  Manufacturer,
  ProductEquivalence,
  ProductFit,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';
import type {
  ApplicationRepository,
  CatalogSourceRepository,
  CrossReferenceRepository,
  CrossReferenceResult,
  DatasetRepository,
  ProductFilter,
  ProductRepository,
  VehicleFilter,
  VehicleRepository,
} from '../interfaces';
import { compactCode, normalizeText } from '@/domain/normalize';
import { yearInRange } from '@/domain/years';

export class PalhetasDexieDB extends Dexie {
  manufacturers!: EntityTable<Manufacturer, 'id'>;
  catalogs!: EntityTable<Catalog, 'id'>;
  sources!: EntityTable<CatalogSource, 'id'>;
  connectors!: EntityTable<Connector, 'id'>;
  connectorEquivalences!: EntityTable<ConnectorEquivalence, 'id'>;
  vehicles!: EntityTable<Vehicle, 'id'>;
  applications!: EntityTable<VehicleApplication, 'id'>;
  products!: EntityTable<BrandProduct, 'id'>;
  fits!: EntityTable<ProductFit, 'id'>;
  equivalences!: EntityTable<ProductEquivalence, 'id'>;
  imports!: EntityTable<ImportRecord, 'importId'>;

  constructor(dbName = 'PalhetasAutomotivasDB') {
    super(dbName);

    // Migrations versionadas
    this.version(1).stores({
      manufacturers: 'id, code, name',
      catalogs: 'id, manufacturerId, catalogYear',
      sources: 'id, catalogId, manufacturer, page',
      connectors: 'id, canonicalCode, code, manufacturerId',
      connectorEquivalences: 'id, connectorAId, connectorBId, type',
      vehicles: 'id, manufacturerId, brand, model, category, yearStart, yearEnd',
      applications: 'id, vehicleId, position, connectorId',
      products: 'id, manufacturerId, code, family, *inches',
      fits: 'id, vehicleApplicationId, brandProductId, relationType',
      equivalences: 'id, productAId, productBId',
      imports: 'importId, source, status',
    });
  }
}

export class DexieCatalogRepository
  implements
    VehicleRepository,
    ProductRepository,
    ApplicationRepository,
    CrossReferenceRepository,
    CatalogSourceRepository,
    DatasetRepository
{
  private db: PalhetasDexieDB;

  constructor(db?: PalhetasDexieDB) {
    this.db = db ?? new PalhetasDexieDB();
  }

  /* ---------------------------------------------------------------- */
  /* VehicleRepository                                                */
  /* ---------------------------------------------------------------- */

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const v = await this.db.vehicles.get(id);
    return v ?? null;
  }

  async searchVehicles(query: string, filter?: VehicleFilter): Promise<Vehicle[]> {
    let collection = this.db.vehicles.toCollection();

    if (filter?.brand) {
      const nBrand = normalizeText(filter.brand);
      collection = collection.filter((v) => normalizeText(v.brand) === nBrand);
    }
    if (filter?.category) {
      collection = collection.filter((v) => v.category === filter.category);
    }
    if (filter?.year !== undefined) {
      const y = filter.year;
      collection = collection.filter((v) => yearInRange(y, v) === true);
    }

    const items = await collection.toArray();
    if (!query.trim()) return items;

    const qTokens = normalizeText(query).split(' ').filter(Boolean);
    return items.filter((v) => {
      const text = normalizeText(`${v.brand} ${v.model} ${v.variant ?? ''} ${v.yearRaw}`);
      return qTokens.every((token) => text.includes(token));
    });
  }

  async listBrands(): Promise<string[]> {
    const brands = await this.db.vehicles.orderBy('brand').uniqueKeys();
    return brands as string[];
  }

  async listModelsByBrand(brand: string): Promise<string[]> {
    const nBrand = normalizeText(brand);
    const vehicles = await this.db.vehicles
      .filter((v) => normalizeText(v.brand) === nBrand)
      .toArray();
    const set = new Set<string>();
    for (const v of vehicles) set.add(v.model);
    return Array.from(set).sort();
  }

  async saveVehicles(vehicles: Vehicle[]): Promise<void> {
    await this.db.vehicles.bulkPut(vehicles);
  }

  async countVehicles(): Promise<number> {
    return this.db.vehicles.count();
  }

  /* ---------------------------------------------------------------- */
  /* ProductRepository                                                */
  /* ---------------------------------------------------------------- */

  async getProductById(id: string): Promise<BrandProduct | null> {
    const p = await this.db.products.get(id);
    return p ?? null;
  }

  async getProductByCode(code: string): Promise<BrandProduct | null> {
    const target = compactCode(code);
    const p = await this.db.products
      .filter((prod) => compactCode(prod.code) === target)
      .first();
    return p ?? null;
  }

  async listProductsByManufacturer(manufacturerId: string): Promise<BrandProduct[]> {
    return this.db.products.where('manufacturerId').equals(manufacturerId).toArray();
  }

  async searchProducts(query: string, filter?: ProductFilter): Promise<BrandProduct[]> {
    let collection = this.db.products.toCollection();

    if (filter?.manufacturerId) {
      collection = collection.filter((p) => p.manufacturerId === filter.manufacturerId);
    }
    if (filter?.family) {
      const nFam = normalizeText(filter.family);
      collection = collection.filter((p) => normalizeText(p.family ?? '') === nFam);
    }
    if (filter?.inches) {
      collection = collection.filter((p) => p.inches.includes(filter.inches!));
    }

    const items = await collection.toArray();
    if (!query.trim()) return items;

    const cQuery = compactCode(query);
    const nQuery = normalizeText(query);

    return items.filter((p) => {
      if (compactCode(p.code).includes(cQuery)) return true;
      const text = normalizeText(`${p.code} ${p.family ?? ''} ${p.mainApplicationsText ?? ''}`);
      return text.includes(nQuery);
    });
  }

  async saveProducts(products: BrandProduct[]): Promise<void> {
    await this.db.products.bulkPut(products);
  }

  async countProducts(): Promise<number> {
    return this.db.products.count();
  }

  /* ---------------------------------------------------------------- */
  /* ApplicationRepository                                            */
  /* ---------------------------------------------------------------- */

  async getApplicationById(id: string): Promise<VehicleApplication | null> {
    const a = await this.db.applications.get(id);
    return a ?? null;
  }

  async listApplicationsByVehicleId(vehicleId: string): Promise<VehicleApplication[]> {
    return this.db.applications.where('vehicleId').equals(vehicleId).toArray();
  }

  async saveApplications(applications: VehicleApplication[]): Promise<void> {
    await this.db.applications.bulkPut(applications);
  }

  async countApplications(): Promise<number> {
    return this.db.applications.count();
  }

  /* ---------------------------------------------------------------- */
  /* CrossReferenceRepository                                         */
  /* ---------------------------------------------------------------- */

  async getFitsByApplicationId(applicationId: string): Promise<ProductFit[]> {
    return this.db.fits.where('vehicleApplicationId').equals(applicationId).toArray();
  }

  async getFitsByProductId(productId: string): Promise<ProductFit[]> {
    return this.db.fits.where('brandProductId').equals(productId).toArray();
  }

  async getEquivalencesForProduct(productId: string): Promise<ProductEquivalence[]> {
    return this.db.equivalences
      .filter((e) => e.productAId === productId || e.productBId === productId)
      .toArray();
  }

  async saveFits(fits: ProductFit[]): Promise<void> {
    await this.db.fits.bulkPut(fits);
  }

  async saveEquivalences(equivalences: ProductEquivalence[]): Promise<void> {
    await this.db.equivalences.bulkPut(equivalences);
  }

  async resolveForVehicle(vehicleId: string): Promise<CrossReferenceResult[]> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) return [];

    const apps = await this.listApplicationsByVehicleId(vehicleId);
    const results: CrossReferenceResult[] = [];

    for (const app of apps) {
      const appFits = await this.getFitsByApplicationId(app.id);
      const byMfr: CrossReferenceResult['productsByManufacturer'] = {};

      for (const fit of appFits) {
        const product = await this.getProductById(fit.brandProductId);
        if (!product) continue;

        const mfrObj = await this.db.manufacturers.get(product.manufacturerId);
        const mfr = mfrObj?.code ?? product.manufacturerId;

        if (!byMfr[mfr]) byMfr[mfr] = [];

        const sources = (await this.db.sources.bulkGet(fit.sourceIds)).filter(
          (s): s is CatalogSource => !!s,
        );

        byMfr[mfr]!.push({
          product,
          relationType: fit.relationType,
          sources,
          notes: fit.notes,
        });
      }

      results.push({
        vehicleApplication: app,
        vehicle,
        productsByManufacturer: byMfr,
      });
    }

    return results;
  }

  /* ---------------------------------------------------------------- */
  /* CatalogSourceRepository                                          */
  /* ---------------------------------------------------------------- */

  async getSourceById(id: string): Promise<CatalogSource | null> {
    const s = await this.db.sources.get(id);
    return s ?? null;
  }

  async getManySourcesByIds(ids: string[]): Promise<CatalogSource[]> {
    const items = await this.db.sources.bulkGet(ids);
    return items.filter((s): s is CatalogSource => !!s);
  }

  async saveSources(sources: CatalogSource[]): Promise<void> {
    await this.db.sources.bulkPut(sources);
  }

  async listCatalogs(): Promise<Catalog[]> {
    return this.db.catalogs.toArray();
  }

  async saveCatalogs(catalogs: Catalog[]): Promise<void> {
    await this.db.catalogs.bulkPut(catalogs);
  }

  /* ---------------------------------------------------------------- */
  /* DatasetRepository                                                */
  /* ---------------------------------------------------------------- */

  async loadDataset(dataset: CatalogDataset): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.manufacturers,
        this.db.catalogs,
        this.db.sources,
        this.db.connectors,
        this.db.connectorEquivalences,
        this.db.vehicles,
        this.db.applications,
        this.db.products,
        this.db.fits,
        this.db.equivalences,
        this.db.imports,
      ],
      async () => {
        await this.db.manufacturers.bulkPut(dataset.manufacturers);
        await this.db.catalogs.bulkPut(dataset.catalogs);
        await this.db.sources.bulkPut(dataset.sources);
        await this.db.connectors.bulkPut(dataset.connectors);
        await this.db.connectorEquivalences.bulkPut(dataset.connectorEquivalences);
        await this.db.vehicles.bulkPut(dataset.vehicles);
        await this.db.applications.bulkPut(dataset.applications);
        await this.db.products.bulkPut(dataset.products);
        await this.db.fits.bulkPut(dataset.fits);
        await this.db.equivalences.bulkPut(dataset.equivalences);
        await this.db.imports.bulkPut(dataset.imports);
      },
    );
  }

  async getDatasetSummary(): Promise<{
    vehiclesCount: number;
    productsCount: number;
    applicationsCount: number;
    fitsCount: number;
    sourcesCount: number;
    manufacturersCount: number;
  }> {
    const [vehiclesCount, productsCount, applicationsCount, fitsCount, sourcesCount, manufacturersCount] =
      await Promise.all([
        this.db.vehicles.count(),
        this.db.products.count(),
        this.db.applications.count(),
        this.db.fits.count(),
        this.db.sources.count(),
        this.db.manufacturers.count(),
      ]);

    return {
      vehiclesCount,
      productsCount,
      applicationsCount,
      fitsCount,
      sourcesCount,
      manufacturersCount,
    };
  }

  async exportDataset(): Promise<CatalogDataset> {
    const [
      manufacturers,
      catalogs,
      sources,
      connectors,
      connectorEquivalences,
      vehicles,
      applications,
      products,
      fits,
      equivalences,
      imports,
    ] = await Promise.all([
      this.db.manufacturers.toArray(),
      this.db.catalogs.toArray(),
      this.db.sources.toArray(),
      this.db.connectors.toArray(),
      this.db.connectorEquivalences.toArray(),
      this.db.vehicles.toArray(),
      this.db.applications.toArray(),
      this.db.products.toArray(),
      this.db.fits.toArray(),
      this.db.equivalences.toArray(),
      this.db.imports.toArray(),
    ]);

    return {
      schemaVersion: 1,
      datasetVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      manufacturers,
      catalogs,
      sources,
      connectors,
      connectorEquivalences,
      vehicles,
      applications,
      products,
      fits,
      equivalences,
      imports,
    };
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.manufacturers.clear(),
      this.db.catalogs.clear(),
      this.db.sources.clear(),
      this.db.connectors.clear(),
      this.db.connectorEquivalences.clear(),
      this.db.vehicles.clear(),
      this.db.applications.clear(),
      this.db.products.clear(),
      this.db.fits.clear(),
      this.db.equivalences.clear(),
      this.db.imports.clear(),
    ]);
  }
}
