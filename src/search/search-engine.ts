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
  VehicleFamilyResult,
} from '@/domain/types';
import { compactCode, normalizeText } from '@/domain/normalize';
import { yearInRange } from '@/domain/years';
import { canonicalizeManufacturer } from '@/domain/manufacturers';
import { cleanVehicleModelFamily } from '@/domain/consolidation';

export function extractYearFromQuery(query: string): number | undefined {
  const match = query.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

export type SearchMatchLevel =
  | 'exact_family'
  | 'exact_model'
  | 'explicit_variant'
  | 'token_match'
  | 'prefix_match'
  | 'fuzzy_match';

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
  type: 'vehicle_family' | 'vehicle' | 'product';
  score: number;
  matchLevel?: SearchMatchLevel;
  family?: VehicleFamilyResult;
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
        const { score: intentScore, matchLevel } = this.calculateVehicleIntentScore(
          v,
          trimmed,
          queryTerms,
          r.score,
        );
        const item = this.buildVehicleResult(v, intentScore, matchLevel);
        if (item && this.matchesFilters(item, filters)) {
          results.push(item);
        }
      } else if (this.productsById.has(r.id)) {
        const p = this.productsById.get(r.id)!;
        // Se a busca principal é por veículo, impede que códigos numéricos residuais (ex: '2015')
        // poluam o resultado com produtos aleatórios cujo código não foi pesquisado
        if (!isProductSearch && trimmed && !this.productMatchesQuery(p, queryTerms, trimmed)) {
          continue;
        }
        const item = this.buildProductResult(p, r.score);
        if (item && this.matchesFilters(item, filters)) {
          results.push(item);
        }
      }

      if (results.length >= 150) break; // Limite de visualização antes da consolidação
    }

    return results;
  }

  private calculateVehicleIntentScore(
    v: Vehicle,
    rawQuery: string,
    terms: string[],
    baseScore = 1,
  ): { score: number; matchLevel: SearchMatchLevel } {
    const normQuery = normalizeText(rawQuery).trim();
    const cleanFam = cleanVehicleModelFamily(v.model);
    const cleanBrand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
    const normModel = normalizeText(v.model).trim();
    const fullFamilyName = `${cleanBrand} ${cleanFam}`.trim();
    const fullModelName = `${cleanBrand} ${normModel}`.trim();

    // 1. Explicit submodel variant requested (e.g. "ONIX PLUS", "COROLLA CROSS", "HB20S")
    const isExplicitVariant =
      ['plus', 'cross', 'fielder', 'sw4', 'sw'].some((sub) =>
        normQuery.includes(sub) && (cleanFam.includes(sub) || normModel.includes(sub)),
      ) || (normQuery.includes('hb20s') && cleanFam === 'hb20s');

    if (
      isExplicitVariant &&
      (normQuery === cleanFam ||
        normQuery === fullFamilyName ||
        normQuery === normModel ||
        normQuery === fullModelName)
    ) {
      return { score: 110 + baseScore, matchLevel: 'explicit_variant' };
    }

    // 2. Exact match on normalized family (e.g. "ONIX", "CHEVROLET ONIX", "COROLLA", "TOYOTA COROLLA")
    if (normQuery === cleanFam || normQuery === fullFamilyName) {
      return { score: 100 + baseScore, matchLevel: 'exact_family' };
    }

    // 3. Exact match on raw model string (e.g. "ONIX 1.0", "HILUX CABINE")
    if (normQuery === normModel || normQuery === fullModelName) {
      return { score: 95 + baseScore, matchLevel: 'exact_model' };
    }

    // 4. Token match (all query tokens match full words in model or brand)
    const modelWords = normModel.split(/[^a-z0-9]+/i).filter(Boolean);
    const brandWords = cleanBrand.split(/[^a-z0-9]+/i).filter(Boolean);
    const allWords = [...brandWords, ...modelWords];
    const isTokenMatch = terms.length > 0 && terms.every((t) => allWords.includes(t));
    if (isTokenMatch) {
      return { score: 70 + baseScore, matchLevel: 'token_match' };
    }

    // 5. Prefix match
    const isPrefixMatch = terms.length > 0 && terms.every((t) => allWords.some((w) => w.startsWith(t)));
    if (isPrefixMatch) {
      return { score: 50 + baseScore, matchLevel: 'prefix_match' };
    }

    // 6. Fuzzy match
    return { score: 30 + baseScore, matchLevel: 'fuzzy_match' };
  }

  private productMatchesQuery(p: BrandProduct, terms: string[], rawQuery: string): boolean {
    const cRaw = compactCode(rawQuery);
    const cCode = compactCode(p.code);
    if (cCode === cRaw || (cRaw.length >= 3 && cCode.includes(cRaw))) return true;
    for (const term of terms) {
      if (/^\d{4}$/.test(term)) continue; // Ano de 4 dígitos não é código de palheta
      const cTerm = compactCode(term);
      if (cTerm.length >= 3 && (cCode === cTerm || cCode.includes(cTerm))) {
        return true;
      }
    }
    return false;
  }

  private vehicleMatchesQuery(v: Vehicle, terms: string[]): boolean {
    const brandNorm = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
    const modelNorm = normalizeText(v.model);
    const modelWords = modelNorm.split(/[^a-z0-9]+/i).filter(Boolean);
    const brandWords = brandNorm.split(/[^a-z0-9]+/i).filter(Boolean);
    const cleanFam = cleanVehicleModelFamily(v.model);

    // 1. Proteção de Submodelos e Famílias Derivadas (Onix Plus, Corolla Cross/Fielder, Hilux SW4)
    const submodelTokens = ['plus', 'cross', 'fielder', 'sw4', 'sw'];
    for (const sub of submodelTokens) {
      const isSwGroup = sub === 'sw4' || sub === 'sw';
      const modelHasSub = isSwGroup
        ? (modelWords.includes('sw4') || modelWords.includes('sw') || cleanFam.includes('sw4'))
        : (modelWords.includes(sub) || cleanFam.includes(sub));
      const queryHasSub = isSwGroup
        ? terms.some((t) => t === 'sw4' || t === 'sw')
        : terms.includes(sub);

      if (modelHasSub && !queryHasSub) return false;
      if (!modelHasSub && queryHasSub && terms.length > 1) return false;
    }

    // 2. Proteção HB20 vs HB20S vs HB20X
    const isHb20s = cleanFam === 'hb20s' || modelWords.includes('hb20s');
    const queryHasHb20s = terms.includes('hb20s') || (terms.includes('hb20') && terms.includes('s'));
    if (isHb20s && !queryHasHb20s) return false;
    if (!isHb20s && queryHasHb20s) return false;

    const isHb20x = cleanFam === 'hb20x' || modelWords.includes('hb20x');
    const queryHasHb20x = terms.includes('hb20x') || (terms.includes('hb20') && terms.includes('x'));
    if (isHb20x && !queryHasHb20x) return false;
    if (!isHb20x && queryHasHb20x) return false;

    // 3. Verificação de correspondência de termos
    for (const term of terms) {
      if (/^\d{4}$/.test(term)) {
        const y = Number(term);
        if (!yearInRange(y, v)) return false;
        continue;
      }

      const matchesBrand = brandWords.some((bw) => bw === term || (bw.startsWith(term) && term.length >= 3));
      const matchesModel = modelWords.some((mw) => {
        if (term.length <= 4) {
          // Termos curtos como "gol", "uno", "ka", "hb20", "c3" exigem palavra idêntica
          return mw === term;
        }
        return mw === term || (mw.startsWith(term) && !modelWords.includes('hb20s'));
      });

      if (!matchesBrand && !matchesModel) {
        return false;
      }
    }

    return true;
  }

  private buildVehicleResult(v: Vehicle, score = 1, matchLevel?: SearchMatchLevel): SearchResultItem {
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
      matchLevel,
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
        const cleanFam = cleanVehicleModelFamily(v.model);

        // Submodel boundaries in filters (Onix Plus, Corolla Cross/Fielder, Hilux SW4)
        for (const sub of ['plus', 'cross', 'fielder', 'sw4', 'sw']) {
          const isSwGroup = sub === 'sw4' || sub === 'sw';
          const modelHasSub = isSwGroup
            ? (modelWords.includes('sw4') || modelWords.includes('sw') || cleanFam.includes('sw4'))
            : (modelWords.includes(sub) || cleanFam.includes(sub));
          const filterHasSub = isSwGroup
            ? (filterWords.includes('sw4') || filterWords.includes('sw'))
            : filterWords.includes(sub);

          if (modelHasSub && !filterHasSub) return false;
          if (!modelHasSub && filterHasSub && filterWords.length > 1) return false;
        }

        // HB20 / HB20S / HB20X in filters
        const isHb20s = cleanFam === 'hb20s' || modelWords.includes('hb20s');
        const filterHasHb20s =
          filterWords.includes('hb20s') || (filterWords.includes('hb20') && filterWords.includes('s'));
        if (isHb20s && !filterHasHb20s) return false;
        if (!isHb20s && filterHasHb20s) return false;

        const isHb20x = cleanFam === 'hb20x' || modelWords.includes('hb20x');
        const filterHasHb20x =
          filterWords.includes('hb20x') || (filterWords.includes('hb20') && filterWords.includes('x'));
        if (isHb20x && !filterHasHb20x) return false;
        if (!isHb20x && filterHasHb20x) return false;

        const matches =
          filterWords.length > 0 &&
          filterWords.every((fw) =>
            modelWords.some((mw) => {
              if (fw.length <= 4) return mw === fw;
              return mw === fw || (mw.startsWith(fw) && !modelWords.includes('hb20s'));
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
