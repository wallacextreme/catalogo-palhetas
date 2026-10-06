import type {
  BrandProduct,
  Catalog,
  CatalogDataset,
  CatalogSource,
  ProductEquivalence,
  ProductFit,
  RelationType,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';

export interface VehicleFilter {
  brand?: string;
  model?: string;
  year?: number;
  category?: string;
}

export interface ProductFilter {
  manufacturerId?: string;
  family?: string;
  code?: string;
  inches?: number;
}

export interface ApplicationFilter {
  vehicleId?: string;
  position?: string;
  connectorId?: string;
}

export interface VehicleRepository {
  getVehicleById(id: string): Promise<Vehicle | null>;
  searchVehicles(query: string, filter?: VehicleFilter): Promise<Vehicle[]>;
  listBrands(): Promise<string[]>;
  listModelsByBrand(brand?: string): Promise<string[]>;
  saveVehicles(vehicles: Vehicle[]): Promise<void>;
  countVehicles(): Promise<number>;
}

export interface ProductRepository {
  getProductById(id: string): Promise<BrandProduct | null>;
  getProductByCode(code: string): Promise<BrandProduct | null>;
  listProductsByManufacturer(manufacturerId: string): Promise<BrandProduct[]>;
  searchProducts(query: string, filter?: ProductFilter): Promise<BrandProduct[]>;
  saveProducts(products: BrandProduct[]): Promise<void>;
  countProducts(): Promise<number>;
}

export interface ApplicationRepository {
  getApplicationById(id: string): Promise<VehicleApplication | null>;
  listApplicationsByVehicleId(vehicleId: string): Promise<VehicleApplication[]>;
  saveApplications(applications: VehicleApplication[]): Promise<void>;
  countApplications(): Promise<number>;
}

export interface CrossReferenceResult {
  vehicleApplication: VehicleApplication;
  vehicle: Vehicle;
  productsByManufacturer: Record<
    string,
    Array<{
      product: BrandProduct;
      relationType: RelationType | 'catalog_documented';
      sources: CatalogSource[];
      notes?: string;
    }>
  >;
}

export interface CrossReferenceRepository {
  getFitsByApplicationId(applicationId: string): Promise<ProductFit[]>;
  getFitsByProductId(productId: string): Promise<ProductFit[]>;
  getEquivalencesForProduct(productId: string): Promise<ProductEquivalence[]>;
  saveFits(fits: ProductFit[]): Promise<void>;
  saveEquivalences(equivalences: ProductEquivalence[]): Promise<void>;
  resolveForVehicle(vehicleId: string): Promise<CrossReferenceResult[]>;
}

export interface CatalogSourceRepository {
  getSourceById(id: string): Promise<CatalogSource | null>;
  getManySourcesByIds(ids: string[]): Promise<CatalogSource[]>;
  saveSources(sources: CatalogSource[]): Promise<void>;
  listCatalogs(): Promise<Catalog[]>;
  saveCatalogs(catalogs: Catalog[]): Promise<void>;
}

export interface DatasetRepository {
  loadDataset(dataset: CatalogDataset): Promise<void>;
  getDatasetSummary(): Promise<{
    vehiclesCount: number;
    productsCount: number;
    applicationsCount: number;
    fitsCount: number;
    sourcesCount: number;
    manufacturersCount: number;
  }>;
  exportDataset(): Promise<CatalogDataset>;
  clearAll(): Promise<void>;
}
