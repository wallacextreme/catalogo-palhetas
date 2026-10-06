import MiniSearch from 'minisearch';
import type {
  BrandProduct,
  CatalogDataset,
  CatalogSource,
  Connector,
  ProductFit,
  RelationType,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';
import { compactCode, normalizeText } from '@/domain/normalize';
import { yearInRange } from '@/domain/years';
import { canonicalizeManufacturer } from '@/domain/manufacturers';

export interface SearchFilters {
  brand?: string;
  model?: string;
  year?: number;
  category?: string;
  position?: string;
  inches?: number;
  connector?: string;
  wiperManufacturer?: string;
  relationType?: RelationType | 'catalog_documented';
}

export interface SearchResultItem {
  id: string;
  type: 'vehicle' | 'product';
  score: number;
  vehicle?: Vehicle;
  product?: BrandProduct;
  matchedApplications?: Array<{
    application: VehicleApplication;
    connector?: Connector;
    fits: Array<{
      product: BrandProduct;
      manufacturerCode: string;
      relationType: RelationType | 'catalog_documented';
      sources: CatalogSource[];
      notes?: string;
    }>;
  }>;
}

interface IndexedDoc {
  id: string;
  type: 'vehicle' | 'product';
  title: string;
  brand: string;
  model: string;
  code: string;
  compactCode: string;
  searchTokens: string;
  yearRaw: string;
  yearStart: number | null;
  yearEnd: number | null;
  category: string;
  manufacturerCode: string;
}

export class CatalogSearchEngine {
  private miniSearch: MiniSearch<IndexedDoc>;
  private dataset: CatalogDataset;
  private vehiclesById = new Map<string, Vehicle>();
  private productsById = new Map<string, BrandProduct>();
  private productsByCode = new Map<string, BrandProduct>();
  private applicationsById = new Map<string, VehicleApplication>();
  private applicationsByVehicleId = new Map<string, VehicleApplication[]>();
  private fitsByApplicationId = new Map<string, ProductFit[]>();
  private connectorsById = new Map<string, Connector>();
  private sourcesById = new Map<string, CatalogSource>();
  private manufacturersById = new Map<string, string>(); // id -> code

  constructor(dataset: CatalogDataset) {
    this.dataset = dataset;

    for (const m of dataset.manufacturers) {
      this.manufacturersById.set(m.id, m.code);
    }
    for (const c of dataset.connectors) {
      this.connectorsById.set(c.id, c);
    }
    for (const s of dataset.sources) {
      this.sourcesById.set(s.id, s);
    }
    for (const v of dataset.vehicles) {
      this.vehiclesById.set(v.id, v);
    }
    for (const a of dataset.applications) {
      this.applicationsById.set(a.id, a);
      if (!this.applicationsByVehicleId.has(a.vehicleId)) {
        this.applicationsByVehicleId.set(a.vehicleId, []);
      }
      this.applicationsByVehicleId.get(a.vehicleId)!.push(a);
    }
    for (const p of dataset.products) {
      this.productsById.set(p.id, p);
      this.productsByCode.set(compactCode(p.code), p);
    }
    for (const f of dataset.fits) {
      if (!this.fitsByApplicationId.has(f.vehicleApplicationId)) {
        this.fitsByApplicationId.set(f.vehicleApplicationId, []);
      }
      this.fitsByApplicationId.get(f.vehicleApplicationId)!.push(f);
    }

    this.miniSearch = new MiniSearch<IndexedDoc>({
      fields: ['title', 'brand', 'model', 'code', 'compactCode', 'searchTokens'],
      storeFields: ['type', 'id'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { code: 5, compactCode: 6, model: 3, brand: 2 },
      },
    });

    this.buildIndex();
  }

  private buildIndex(): void {
    const docs: IndexedDoc[] = [];

    // Indexa Veículos
    for (const v of this.dataset.vehicles) {
      const apps = this.applicationsByVehicleId.get(v.id) ?? [];
      const appProductCodes = apps
        .flatMap((a) => this.fitsByApplicationId.get(a.id) ?? [])
        .map((f) => {
          const p = this.productsById.get(f.brandProductId);
          return p ? `${p.code} ${compactCode(p.code)}` : '';
        })
        .join(' ');

      const title = `${v.brand} ${v.model} ${v.variant ?? ''} ${v.yearRaw}`.trim();
      docs.push({
        id: v.id,
        type: 'vehicle',
        title,
        brand: normalizeText(v.brand),
        model: normalizeText(v.model),
        code: '',
        compactCode: '',
        searchTokens: normalizeText(`${title} ${appProductCodes}`),
        yearRaw: v.yearRaw,
        yearStart: v.yearStart,
        yearEnd: v.yearEnd,
        category: v.category,
        manufacturerCode: '',
      });
    }

    // Indexa Produtos
    for (const p of this.dataset.products) {
      const mfrCode = this.manufacturersById.get(p.manufacturerId) ?? '';
      const title = `${p.code} ${mfrCode} ${p.family ?? ''}`.trim();
      docs.push({
        id: p.id,
        type: 'product',
        title,
        brand: '',
        model: '',
        code: p.code,
        compactCode: compactCode(p.code),
        searchTokens: normalizeText(`${title} ${p.code} ${compactCode(p.code)}`),
        yearRaw: '',
        yearStart: null,
        yearEnd: null,
        category: '',
        manufacturerCode: mfrCode,
      });
    }

    this.miniSearch.addAll(docs);
  }

  /**
   * Executa busca inteligente multi-critério (por veículo ou código de produto) com filtros combináveis.
   */
  public search(query: string, filters?: SearchFilters): SearchResultItem[] {
    const trimmed = query.trim();
    const cQuery = compactCode(trimmed);

    // 1. Checa busca exata por código de produto primeiro
    if (cQuery.length >= 3 && this.productsByCode.has(cQuery)) {
      const p = this.productsByCode.get(cQuery)!;
      const res = this.buildProductResult(p);
      if (res && this.matchesFilters(res, filters)) {
        return [res];
      }
    }

    // 2. Busca via MiniSearch com tokenização e normalização
    const queryTerms = trimmed
      ? normalizeText(trimmed)
          .split(/\s+/)
          .filter((t) => t.length > 0)
      : [];

    const isProductSearch =
      this.productsByCode.has(cQuery) ||
      queryTerms.some((t) => t.length >= 3 && this.productsByCode.has(compactCode(t)));

    const hasActiveFilters = Boolean(
      filters && Object.values(filters).some((v) => v !== undefined && v !== ''),
    );

    let searchResults: { id: string; score: number }[];

    if (trimmed) {
      searchResults = this.miniSearch.search(normalizeText(trimmed));
    } else if (hasActiveFilters) {
      // Quando há filtros combinados ativos sem query geral, varre todos os veículos do catálogo
      searchResults = this.dataset.vehicles.map((v) => ({ id: v.id, score: 1 }));
    } else {
      // Carregamento inicial leve padrão
      searchResults = this.dataset.vehicles.slice(0, 150).map((v) => ({ id: v.id, score: 1 }));
    }

    const results: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    for (const r of searchResults) {
      if (seenIds.has(r.id)) continue;
      seenIds.add(r.id);

      if (this.vehiclesById.has(r.id)) {
        const v = this.vehiclesById.get(r.id)!;
        // Se a busca é por nome de veículo, impede vazamento de outros modelos (ex: gol vs golf, hilux vs corolla)
        if (!isProductSearch && queryTerms.length > 0 && !this.vehicleMatchesQuery(v, queryTerms)) {
          continue;
        }
        const item = this.buildVehicleResult(v, r.score);
        if (item && this.matchesFilters(item, filters)) {
          results.push(item);
        }
      } else if (this.productsById.has(r.id)) {
        const p = this.productsById.get(r.id)!;
        const item = this.buildProductResult(p, r.score);
        if (item && this.matchesFilters(item, filters)) {
          results.push(item);
        }
      }

      if (results.length >= 150) break; // Limite de visualização antes da consolidação
    }

    return results;
  }

  private vehicleMatchesQuery(v: Vehicle, terms: string[]): boolean {
    const brandNorm = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
    const modelNorm = normalizeText(v.model);
    const modelWords = modelNorm.split(/[^a-z0-9]+/i).filter(Boolean);
    const brandWords = brandNorm.split(/[^a-z0-9]+/i).filter(Boolean);

    for (const term of terms) {
      if (/^\d{4}$/.test(term)) {
        const y = Number(term);
        if (!yearInRange(y, v)) return false;
        continue;
      }

      const matchesBrand = brandWords.some((bw) => bw === term || (bw.startsWith(term) && term.length >= 3));
      const matchesModel = modelWords.some((mw) => {
        if (term.length <= 3) {
          // Termos curtos como "gol", "uno", "ka", "c3" exigem palavra idêntica
          return mw === term;
        }
        return mw === term || mw.startsWith(term);
      });

      if (!matchesBrand && !matchesModel) {
        return false;
      }
    }

    return true;
  }

  private buildVehicleResult(v: Vehicle, score = 1): SearchResultItem {
    const apps = this.applicationsByVehicleId.get(v.id) ?? [];
    const matchedApps = apps.map((a) => {
      const conn = a.connectorId ? this.connectorsById.get(a.connectorId) : undefined;
      const appFits = this.fitsByApplicationId.get(a.id) ?? [];

      const fits = appFits.map((f) => {
        const prod = this.productsById.get(f.brandProductId)!;
        const mfrCode = this.manufacturersById.get(prod.manufacturerId) ?? 'OUTROS';
        const sources = f.sourceIds
          .map((sId) => this.sourcesById.get(sId))
          .filter((s): s is CatalogSource => !!s);

        return {
          product: prod,
          manufacturerCode: mfrCode,
          relationType: f.relationType,
          sources,
          notes: f.notes,
        };
      });

      return {
        application: a,
        connector: conn,
        fits,
      };
    });

    return {
      id: v.id,
      type: 'vehicle',
      score,
      vehicle: v,
      matchedApplications: matchedApps,
    };
  }

  private buildProductResult(p: BrandProduct, score = 10): SearchResultItem {
    // Localiza aplicações onde este produto se encaixa
    const matchingAppIds = this.dataset.fits
      .filter((f) => f.brandProductId === p.id)
      .map((f) => f.vehicleApplicationId);

    const firstApp = matchingAppIds[0] ? this.applicationsById.get(matchingAppIds[0]) : undefined;
    const firstVehicle = firstApp ? this.vehiclesById.get(firstApp.vehicleId) : undefined;

    return {
      id: p.id,
      type: 'product',
      score,
      product: p,
      vehicle: firstVehicle,
      matchedApplications: firstApp
        ? [
            {
              application: firstApp,
              connector: firstApp.connectorId ? this.connectorsById.get(firstApp.connectorId) : undefined,
              fits: [
                {
                  product: p,
                  manufacturerCode: this.manufacturersById.get(p.manufacturerId) ?? '',
                  relationType: 'catalog_documented',
                  sources: p.sourceIds
                    .map((sId) => this.sourcesById.get(sId))
                    .filter((s): s is CatalogSource => !!s),
                },
              ],
            },
          ]
        : [],
    };
  }

  private matchesFilters(item: SearchResultItem, f?: SearchFilters): boolean {
    if (!f) return true;

    if (item.vehicle) {
      const v = item.vehicle;
      if (f.brand) {
        const fCanon = canonicalizeManufacturer(f.brand) ?? f.brand;
        const vCanon = canonicalizeManufacturer(v.brand) ?? v.brand;
        if (normalizeText(vCanon) !== normalizeText(fCanon)) return false;
      }
      if (f.model) {
        const normFilter = normalizeText(f.model);
        const normModel = normalizeText(v.model);
        const filterWords = normFilter.split(/[^a-z0-9]+/i).filter(Boolean);
        const modelWords = normModel.split(/[^a-z0-9]+/i).filter(Boolean);
        const matches =
          filterWords.length > 0 &&
          filterWords.every((fw) =>
            modelWords.some((mw) => {
              if (fw.length <= 3) return mw === fw;
              return mw === fw || mw.startsWith(fw);
            }),
          );
        if (!matches) return false;
      }
      if (f.category && v.category !== f.category) return false;
      if (f.year !== undefined && !yearInRange(f.year, v)) return false;
    }

    if (f.position && item.matchedApplications) {
      const hasPos = item.matchedApplications.some((a) => a.application.position === f.position);
      if (!hasPos) return false;
    }

    if (f.inches && item.matchedApplications) {
      const hasInch = item.matchedApplications.some((a) => a.application.inches === f.inches);
      if (!hasInch) return false;
    }

    if (f.connector && item.matchedApplications) {
      const hasConn = item.matchedApplications.some(
        (a) => a.application.connectorRaw === f.connector || a.connector?.code === f.connector,
      );
      if (!hasConn) return false;
    }

    if (f.wiperManufacturer && item.matchedApplications) {
      const hasMfr = item.matchedApplications.some((a) =>
        a.fits.some((fit) => fit.manufacturerCode === f.wiperManufacturer),
      );
      if (!hasMfr) return false;
    }

    if (f.relationType && item.matchedApplications) {
      const hasRel = item.matchedApplications.some((a) =>
        a.fits.some((fit) => fit.relationType === f.relationType),
      );
      if (!hasRel) return false;
    }

    return true;
  }
}
