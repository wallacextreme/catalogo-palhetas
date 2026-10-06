import type {
  BrandProduct,
  Catalog,
  CatalogSource,
  Connector,
  ConnectorEquivalence,
  ImportRecord,
  Manufacturer,
  ProductFit,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';

export interface RawSpan {
  t: string;
  b: number;
  l: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sz: number;
  f: string;
  c: number;
}

export interface RawPage {
  page: number;
  width: number;
  height: number;
  spans: RawSpan[];
  images: Array<{
    xref: number;
    digest: string | null;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    w?: number;
    h?: number;
  }>;
}

export interface RawExtraction {
  sourceId: string;
  file: string;
  sha256: string;
  pageCount: number;
  extractor: string;
  pages: RawPage[];
}

export interface ParseResult {
  manufacturer: Manufacturer;
  catalog: Catalog;
  sources: CatalogSource[];
  connectors: Connector[];
  connectorEquivalences: ConnectorEquivalence[];
  vehicles: Vehicle[];
  applications: VehicleApplication[];
  products: BrandProduct[];
  fits: ProductFit[];
  importRecord: ImportRecord;
  warnings: string[];
  excludedItems: Array<{ source: string; reason: string; item: string }>;
}
