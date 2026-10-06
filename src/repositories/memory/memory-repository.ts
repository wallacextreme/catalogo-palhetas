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
import { compactCode, normalizeText, titleCase } from '@/domain/normalize';
import { yearInRange } from '@/domain/years';
import { canonicalizeManufacturer, OFFICIAL_VEHICLE_MANUFACTURERS } from '@/domain/manufacturers';
import { cleanVehicleModelFamily } from '@/domain/consolidation';

export class InMemoryCatalogDatabase
  implements
    VehicleRepository,
    ProductRepository,
    ApplicationRepository,
    CrossReferenceRepository,
    CatalogSourceRepository,
    DatasetRepository
{
  private manufacturers = new Map<string, Manufacturer>();
  private catalogs = new Map<string, Catalog>();
  private sources = new Map<string, CatalogSource>();
  private connectors = new Map<string, Connector>();
  private connectorEquivalences = new Map<string, ConnectorEquivalence>();
  private vehicles = new Map<string, Vehicle>();
  private applications = new Map<string, VehicleApplication>();
  private products = new Map<string, BrandProduct>();
  private productsByCode = new Map<string, string>(); // compactCode -> productId
  private fits = new Map<string, ProductFit>();
  private equivalences = new Map<string, ProductEquivalence>();
  private imports: ImportRecord[] = [];

  /* ---------------------------------------------------------------- */
  /* Manufacturer helper                                              */
  /* ---------------------------------------------------------------- */

  getManufacturerById(id: string): Manufacturer | null {
    return this.manufacturers.get(id) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* VehicleRepository                                                */
  /* ---------------------------------------------------------------- */

  async getVehicleById(id: string): Promise<Vehicle | null> {
    return this.vehicles.get(id) ?? null;
  }

  async searchVehicles(query: string, filter?: VehicleFilter): Promise<Vehicle[]> {
    const qTokens = normalizeText(query).split(' ').filter(Boolean);

    return Array.from(this.vehicles.values()).filter((v) => {
      if (filter?.brand) {
        const fCanon = canonicalizeManufacturer(filter.brand) ?? filter.brand;
        const vCanon = canonicalizeManufacturer(v.brand) ?? v.brand;
        if (normalizeText(vCanon) !== normalizeText(fCanon)) {
          return false;
        }
      }
      if (filter?.model && !normalizeText(v.model).includes(normalizeText(filter.model))) {
        return false;
      }
      if (filter?.category && v.category !== filter.category) {
        return false;
      }
      if (filter?.year !== undefined) {
        if (!yearInRange(filter.year, v)) return false;
      }

      if (qTokens.length === 0) return true;

      const vText = normalizeText(`${v.brand} ${v.model} ${v.variant ?? ''} ${v.yearRaw}`);
      return qTokens.every((token) => vText.includes(token));
    });
  }

  async listBrands(): Promise<string[]> {
    const presentBrands = new Set<string>();
    for (const v of this.vehicles.values()) {
      const canon = canonicalizeManufacturer(v.brand);
      if (canon) {
        presentBrands.add(canon);
      }
    }
    return OFFICIAL_VEHICLE_MANUFACTURERS.filter((m) => presentBrands.has(m));
  }

  async listModelsByBrand(brand?: string): Promise<string[]> {
    const set = new Set<string>();
    const nBrand = brand && brand.trim() ? normalizeText(canonicalizeManufacturer(brand) ?? brand) : null;
    for (const v of this.vehicles.values()) {
      if (nBrand) {
        const vCanon = canonicalizeManufacturer(v.brand) ?? v.brand;
        if (normalizeText(vCanon) !== nBrand) continue;
      }
      const clean = cleanVehicleModelFamily(v.model);
      if (clean && clean.length >= 2) {
        set.add(titleCase(clean));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async saveVehicles(vehicles: Vehicle[]): Promise<void> {
    for (const v of vehicles) {
      this.vehicles.set(v.id, v);
    }
  }

  async countVehicles(): Promise<number> {
    return this.vehicles.size;
  }

  /* ---------------------------------------------------------------- */
  /* ProductRepository                                                */
  /* ---------------------------------------------------------------- */

  async getProductById(id: string): Promise<BrandProduct | null> {
    return this.products.get(id) ?? null;
  }

  async getProductByCode(code: string): Promise<BrandProduct | null> {
    const target = compactCode(code);
    const id = this.productsByCode.get(target);
    if (id) return this.products.get(id) ?? null;

    for (const p of this.products.values()) {
      if (compactCode(p.code) === target) {
        return p;
      }
    }
    return null;
  }

  async listProductsByManufacturer(manufacturerId: string): Promise<BrandProduct[]> {
    return Array.from(this.products.values()).filter(
      (p) => p.manufacturerId === manufacturerId,
    );
  }

  async searchProducts(query: string, filter?: ProductFilter): Promise<BrandProduct[]> {
    const cQuery = compactCode(query);
    const nQuery = normalizeText(query);

    return Array.from(this.products.values()).filter((p) => {
      if (filter?.manufacturerId && p.manufacturerId !== filter.manufacturerId) {
        return false;
      }
      if (filter?.family && normalizeText(p.family ?? '') !== normalizeText(filter.family)) {
        return false;
      }
      if (filter?.inches && !p.inches.includes(filter.inches)) {
        return false;
      }

      if (!query.trim()) return true;

      const pCode = compactCode(p.code);
      if (pCode.includes(cQuery)) return true;

      const pText = normalizeText(
        `${p.code} ${p.family ?? ''} ${p.subfamily ?? ''} ${p.mainApplicationsText ?? ''}`,
      );
      return pText.includes(nQuery);
    });
  }

  async saveProducts(products: BrandProduct[]): Promise<void> {
    for (const p of products) {
      this.products.set(p.id, p);
      this.productsByCode.set(compactCode(p.code), p.id);
    }
  }

  async countProducts(): Promise<number> {
    return this.products.size;
  }

  /* ---------------------------------------------------------------- */
  /* ApplicationRepository                                            */
  /* ---------------------------------------------------------------- */

  async getApplicationById(id: string): Promise<VehicleApplication | null> {
    return this.applications.get(id) ?? null;
  }

  async listApplicationsByVehicleId(vehicleId: string): Promise<VehicleApplication[]> {
    return Array.from(this.applications.values()).filter(
      (a) => a.vehicleId === vehicleId,
    );
  }

  async saveApplications(applications: VehicleApplication[]): Promise<void> {
    for (const a of applications) {
      this.applications.set(a.id, a);
    }
  }

  async countApplications(): Promise<number> {
    return this.applications.size;
  }

  /* ---------------------------------------------------------------- */
  /* CrossReferenceRepository                                         */
  /* ---------------------------------------------------------------- */

  async getFitsByApplicationId(applicationId: string): Promise<ProductFit[]> {
    return Array.from(this.fits.values()).filter(
      (f) => f.vehicleApplicationId === applicationId,
    );
  }

  async getFitsByProductId(productId: string): Promise<ProductFit[]> {
    return Array.from(this.fits.values()).filter(
      (f) => f.brandProductId === productId,
    );
  }

  async getEquivalencesForProduct(productId: string): Promise<ProductEquivalence[]> {
    return Array.from(this.equivalences.values()).filter(
      (e) => e.productAId === productId || e.productBId === productId,
    );
  }

  async saveFits(fits: ProductFit[]): Promise<void> {
    for (const f of fits) {
      this.fits.set(f.id, f);
    }
  }

  async saveEquivalences(equivalences: ProductEquivalence[]): Promise<void> {
    for (const e of equivalences) {
      this.equivalences.set(e.id, e);
    }
  }

  async resolveForVehicle(vehicleId: string): Promise<CrossReferenceResult[]> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return [];

    const apps = await this.listApplicationsByVehicleId(vehicleId);
    const results: CrossReferenceResult[] = [];

    for (const app of apps) {
      const appFits = await this.getFitsByApplicationId(app.id);
      const byMfr: CrossReferenceResult['productsByManufacturer'] = {};

      for (const fit of appFits) {
        const product = this.products.get(fit.brandProductId);
        if (!product) continue;

        const mfr = this.manufacturers.get(product.manufacturerId)?.code ?? product.manufacturerId;
        if (!byMfr[mfr]) byMfr[mfr] = [];

        const sources = fit.sourceIds
          .map((sId) => this.sources.get(sId))
          .filter((s): s is CatalogSource => !!s);

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
    return this.sources.get(id) ?? null;
  }

  async getManySourcesByIds(ids: string[]): Promise<CatalogSource[]> {
    const list: CatalogSource[] = [];
    for (const id of ids) {
      const s = this.sources.get(id);
      if (s) list.push(s);
    }
    return list;
  }

  async saveSources(sources: CatalogSource[]): Promise<void> {
    for (const s of sources) {
      this.sources.set(s.id, s);
    }
  }

  async listCatalogs(): Promise<Catalog[]> {
    return Array.from(this.catalogs.values());
  }

  async saveCatalogs(catalogs: Catalog[]): Promise<void> {
    for (const c of catalogs) {
      this.catalogs.set(c.id, c);
    }
  }

  /* ---------------------------------------------------------------- */
  /* DatasetRepository                                                */
  /* ---------------------------------------------------------------- */

  async loadDataset(dataset: CatalogDataset): Promise<void> {
    for (const m of dataset.manufacturers) this.manufacturers.set(m.id, m);
    for (const c of dataset.catalogs) this.catalogs.set(c.id, c);
    for (const s of dataset.sources) this.sources.set(s.id, s);
    for (const cn of dataset.connectors) this.connectors.set(cn.id, cn);
    for (const ce of dataset.connectorEquivalences) this.connectorEquivalences.set(ce.id, ce);
    for (const v of dataset.vehicles) this.vehicles.set(v.id, v);
    for (const a of dataset.applications) this.applications.set(a.id, a);
    for (const p of dataset.products) {
      this.products.set(p.id, p);
      this.productsByCode.set(compactCode(p.code), p.id);
    }
    for (const f of dataset.fits) this.fits.set(f.id, f);
    for (const e of dataset.equivalences) this.equivalences.set(e.id, e);
    this.imports = [...dataset.imports];
  }

  async getDatasetSummary(): Promise<{
    vehiclesCount: number;
    productsCount: number;
    applicationsCount: number;
    fitsCount: number;
    sourcesCount: number;
    manufacturersCount: number;
  }> {
    return {
      vehiclesCount: this.vehicles.size,
      productsCount: this.products.size,
      applicationsCount: this.applications.size,
      fitsCount: this.fits.size,
      sourcesCount: this.sources.size,
      manufacturersCount: this.manufacturers.size,
    };
  }

  async exportDataset(): Promise<CatalogDataset> {
    return {
      schemaVersion: 1,
      datasetVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      manufacturers: Array.from(this.manufacturers.values()),
      catalogs: Array.from(this.catalogs.values()),
      sources: Array.from(this.sources.values()),
      connectors: Array.from(this.connectors.values()),
      connectorEquivalences: Array.from(this.connectorEquivalences.values()),
      vehicles: Array.from(this.vehicles.values()),
      applications: Array.from(this.applications.values()),
      products: Array.from(this.products.values()),
      fits: Array.from(this.fits.values()),
      equivalences: Array.from(this.equivalences.values()),
      imports: [...this.imports],
    };
  }

  async clearAll(): Promise<void> {
    this.manufacturers.clear();
    this.catalogs.clear();
    this.sources.clear();
    this.connectors.clear();
    this.connectorEquivalences.clear();
    this.vehicles.clear();
    this.applications.clear();
    this.products.clear();
    this.productsByCode.clear();
    this.fits.clear();
    this.equivalences.clear();
    this.imports = [];
  }
}
