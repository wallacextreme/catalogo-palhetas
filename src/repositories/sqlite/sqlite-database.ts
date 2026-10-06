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

export interface SqlDatabaseClient {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class SqliteCatalogRepository
  implements
    VehicleRepository,
    ProductRepository,
    ApplicationRepository,
    CrossReferenceRepository,
    CatalogSourceRepository,
    DatasetRepository
{
  constructor(private client: SqlDatabaseClient) {}

  /* ---------------------------------------------------------------- */
  /* VehicleRepository                                                */
  /* ---------------------------------------------------------------- */

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const rows = await this.client.select<any>(
      'SELECT * FROM vehicles WHERE id = ? LIMIT 1',
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapVehicleRow(rows[0]);
  }

  async searchVehicles(query: string, filter?: VehicleFilter): Promise<Vehicle[]> {
    let sql = 'SELECT * FROM vehicles WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.brand) {
      sql += ' AND LOWER(brand) = LOWER(?)';
      params.push(filter.brand);
    }
    if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    }

    const rows = await this.client.select<any>(sql, params);
    let vehicles = rows.map((r) => this.mapVehicleRow(r));

    if (filter?.year !== undefined) {
      const y = filter.year;
      vehicles = vehicles.filter((v) => yearInRange(y, v) === true);
    }

    if (!query.trim()) return vehicles;

    const qTokens = normalizeText(query).split(' ').filter(Boolean);
    return vehicles.filter((v) => {
      const text = normalizeText(`${v.brand} ${v.model} ${v.variant ?? ''} ${v.yearRaw}`);
      return qTokens.every((token) => text.includes(token));
    });
  }

  async listBrands(): Promise<string[]> {
    const rows = await this.client.select<{ brand: string }>(
      'SELECT DISTINCT brand FROM vehicles ORDER BY brand ASC',
    );
    return rows.map((r) => r.brand);
  }

  async listModelsByBrand(brand: string): Promise<string[]> {
    const rows = await this.client.select<{ model: string }>(
      'SELECT DISTINCT model FROM vehicles WHERE LOWER(brand) = LOWER(?) ORDER BY model ASC',
      [brand],
    );
    return rows.map((r) => r.model);
  }

  async saveVehicles(vehicles: Vehicle[]): Promise<void> {
    for (const v of vehicles) {
      await this.client.execute(
        `INSERT OR REPLACE INTO vehicles (
          id, manufacturer_id, brand, model, generation, variant, body_style,
          category, year_start, year_end, year_end_open, year_raw, notes, source_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          v.manufacturerId,
          v.brand,
          v.model,
          v.generation ?? null,
          v.variant ?? null,
          v.bodyStyle ?? null,
          v.category,
          v.yearStart,
          v.yearEnd,
          v.yearEndOpen ? 1 : 0,
          v.yearRaw,
          v.notes ?? null,
          JSON.stringify(v.sourceIds),
        ],
      );
    }
  }

  async countVehicles(): Promise<number> {
    const rows = await this.client.select<{ c: number }>(
      'SELECT COUNT(*) as c FROM vehicles',
    );
    return rows[0]?.c ?? 0;
  }

  /* ---------------------------------------------------------------- */
  /* ProductRepository                                                */
  /* ---------------------------------------------------------------- */

  async getProductById(id: string): Promise<BrandProduct | null> {
    const rows = await this.client.select<any>(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapProductRow(rows[0]);
  }

  async getProductByCode(code: string): Promise<BrandProduct | null> {
    const target = compactCode(code);
    const rows = await this.client.select<any>(
      'SELECT * FROM products WHERE compact_code = ? LIMIT 1',
      [target],
    );
    if (rows.length === 0) return null;
    return this.mapProductRow(rows[0]);
  }

  async listProductsByManufacturer(manufacturerId: string): Promise<BrandProduct[]> {
    const rows = await this.client.select<any>(
      'SELECT * FROM products WHERE manufacturer_id = ?',
      [manufacturerId],
    );
    return rows.map((r) => this.mapProductRow(r));
  }

  async searchProducts(query: string, filter?: ProductFilter): Promise<BrandProduct[]> {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: unknown[] = [];

    if (filter?.manufacturerId) {
      sql += ' AND manufacturer_id = ?';
      params.push(filter.manufacturerId);
    }
    if (filter?.family) {
      sql += ' AND LOWER(family) = LOWER(?)';
      params.push(filter.family);
    }

    const rows = await this.client.select<any>(sql, params);
    let products = rows.map((r) => this.mapProductRow(r));

    if (filter?.inches) {
      products = products.filter((p) => p.inches.includes(filter.inches!));
    }

    if (!query.trim()) return products;

    const cQuery = compactCode(query);
    const nQuery = normalizeText(query);

    return products.filter((p) => {
      if (compactCode(p.code).includes(cQuery)) return true;
      const text = normalizeText(`${p.code} ${p.family ?? ''} ${p.mainApplicationsText ?? ''}`);
      return text.includes(nQuery);
    });
  }

  async saveProducts(products: BrandProduct[]): Promise<void> {
    for (const p of products) {
      await this.client.execute(
        `INSERT OR REPLACE INTO products (
          id, manufacturer_id, code, compact_code, family, subfamily, construction,
          package_type, inches, millimeters, arm_compatibility, application_scope,
          main_applications_text, notes, source_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.manufacturerId,
          p.code,
          compactCode(p.code),
          p.family ?? null,
          p.subfamily ?? null,
          p.construction ?? null,
          p.packageType ?? null,
          JSON.stringify(p.inches),
          JSON.stringify(p.millimeters),
          JSON.stringify(p.armCompatibility),
          p.applicationScope ?? null,
          p.mainApplicationsText ?? null,
          p.notes ?? null,
          JSON.stringify(p.sourceIds),
        ],
      );
    }
  }

  async countProducts(): Promise<number> {
    const rows = await this.client.select<{ c: number }>(
      'SELECT COUNT(*) as c FROM products',
    );
    return rows[0]?.c ?? 0;
  }

  /* ---------------------------------------------------------------- */
  /* ApplicationRepository                                            */
  /* ---------------------------------------------------------------- */

  async getApplicationById(id: string): Promise<VehicleApplication | null> {
    const rows = await this.client.select<any>(
      'SELECT * FROM applications WHERE id = ? LIMIT 1',
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapApplicationRow(rows[0]);
  }

  async listApplicationsByVehicleId(vehicleId: string): Promise<VehicleApplication[]> {
    const rows = await this.client.select<any>(
      'SELECT * FROM applications WHERE vehicle_id = ?',
      [vehicleId],
    );
    return rows.map((r) => this.mapApplicationRow(r));
  }

  async saveApplications(applications: VehicleApplication[]): Promise<void> {
    for (const a of applications) {
      await this.client.execute(
        `INSERT OR REPLACE INTO applications (
          id, vehicle_id, position, inches, millimeters, source_inches,
          source_millimeters, calculated_millimeters, size_label, measure_origin,
          connector_id, connector_raw, notes, source_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.vehicleId,
          a.position,
          a.inches,
          a.millimeters,
          a.sourceInches,
          a.sourceMillimeters,
          a.calculatedMillimeters,
          a.sizeLabel,
          a.measureOrigin,
          a.connectorId ?? null,
          a.connectorRaw ?? null,
          a.notes ?? null,
          JSON.stringify(a.sourceIds),
        ],
      );
    }
  }

  async countApplications(): Promise<number> {
    const rows = await this.client.select<{ c: number }>(
      'SELECT COUNT(*) as c FROM applications',
    );
    return rows[0]?.c ?? 0;
  }

  /* ---------------------------------------------------------------- */
  /* CrossReferenceRepository                                         */
  /* ---------------------------------------------------------------- */

  async getFitsByApplicationId(applicationId: string): Promise<ProductFit[]> {
    const rows = await this.client.select<any>(
      'SELECT * FROM fits WHERE vehicle_application_id = ?',
      [applicationId],
    );
    return rows.map((r) => ({
      id: r.id,
      vehicleApplicationId: r.vehicle_application_id,
      brandProductId: r.brand_product_id,
      relationType: r.relation_type,
      sourceIds: JSON.parse(r.source_ids),
      notes: r.notes ?? undefined,
    }));
  }

  async getFitsByProductId(productId: string): Promise<ProductFit[]> {
    const rows = await this.client.select<any>(
      'SELECT * FROM fits WHERE brand_product_id = ?',
      [productId],
    );
    return rows.map((r) => ({
      id: r.id,
      vehicleApplicationId: r.vehicle_application_id,
      brandProductId: r.brand_product_id,
      relationType: r.relation_type,
      sourceIds: JSON.parse(r.source_ids),
      notes: r.notes ?? undefined,
    }));
  }

  async getEquivalencesForProduct(productId: string): Promise<ProductEquivalence[]> {
    const rows = await this.client.select<any>(
      'SELECT * FROM equivalences WHERE product_a_id = ? OR product_b_id = ?',
      [productId, productId],
    );
    return rows.map((r) => ({
      id: r.id,
      productAId: r.product_a_id,
      productBId: r.product_b_id,
      relationType: 'documented_equivalence',
      sourceIds: JSON.parse(r.source_ids),
      notes: r.notes ?? undefined,
    }));
  }

  async saveFits(fits: ProductFit[]): Promise<void> {
    for (const f of fits) {
      await this.client.execute(
        `INSERT OR REPLACE INTO fits (
          id, vehicle_application_id, brand_product_id, relation_type, source_ids, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [f.id, f.vehicleApplicationId, f.brandProductId, f.relationType, JSON.stringify(f.sourceIds), f.notes ?? null],
      );
    }
  }

  async saveEquivalences(equivalences: ProductEquivalence[]): Promise<void> {
    for (const e of equivalences) {
      await this.client.execute(
        `INSERT OR REPLACE INTO equivalences (
          id, product_a_id, product_b_id, relation_type, source_ids, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [e.id, e.productAId, e.productBId, e.relationType, JSON.stringify(e.sourceIds), e.notes ?? null],
      );
    }
  }

  async resolveForVehicle(vehicleId: string): Promise<CrossReferenceResult[]> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) return [];

    const apps = await this.listApplicationsByVehicleId(vehicleId);
    const results: CrossReferenceResult[] = [];

    for (const app of apps) {
      const fits = await this.getFitsByApplicationId(app.id);
      const byMfr: CrossReferenceResult['productsByManufacturer'] = {};

      for (const fit of fits) {
        const product = await this.getProductById(fit.brandProductId);
        if (!product) continue;

        const mfrRows = await this.client.select<{ code: string }>(
          'SELECT code FROM manufacturers WHERE id = ? LIMIT 1',
          [product.manufacturerId],
        );
        const mfr = mfrRows[0]?.code ?? product.manufacturerId;

        if (!byMfr[mfr]) byMfr[mfr] = [];

        const sources = await this.getManySourcesByIds(fit.sourceIds);

        byMfr[mfr]!.push({
          product,
          relationType: fit.relationType as RelationType,
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
    const rows = await this.client.select<any>(
      'SELECT * FROM sources WHERE id = ? LIMIT 1',
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapSourceRow(rows[0]);
  }

  async getManySourcesByIds(ids: string[]): Promise<CatalogSource[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.client.select<any>(
      `SELECT * FROM sources WHERE id IN (${placeholders})`,
      ids,
    );
    return rows.map((r) => this.mapSourceRow(r));
  }

  async saveSources(sources: CatalogSource[]): Promise<void> {
    for (const s of sources) {
      await this.client.execute(
        `INSERT OR REPLACE INTO sources (
          id, catalog_id, manufacturer, catalog_name, catalog_year, page, section, source_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.catalogId, s.manufacturer, s.catalogName, s.catalogYear, s.page, s.section ?? null, s.sourceReference ?? null],
      );
    }
  }

  async listCatalogs(): Promise<Catalog[]> {
    const rows = await this.client.select<any>('SELECT * FROM catalogs');
    return rows.map((r) => ({
      id: r.id,
      manufacturerId: r.manufacturer_id,
      catalogName: r.catalog_name,
      catalogYear: r.catalog_year,
      fileName: r.file_name,
      sha256: r.sha256 ?? null,
      pageCount: r.page_count ?? null,
    }));
  }

  async saveCatalogs(catalogs: Catalog[]): Promise<void> {
    for (const c of catalogs) {
      await this.client.execute(
        `INSERT OR REPLACE INTO catalogs (
          id, manufacturer_id, catalog_name, catalog_year, file_name, sha256, page_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.manufacturerId, c.catalogName, c.catalogYear, c.fileName, c.sha256 ?? null, c.pageCount ?? null],
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* DatasetRepository                                                */
  /* ---------------------------------------------------------------- */

  async loadDataset(dataset: CatalogDataset): Promise<void> {
    for (const m of dataset.manufacturers) {
      await this.client.execute(
        'INSERT OR REPLACE INTO manufacturers (id, code, name, active, roles) VALUES (?, ?, ?, ?, ?)',
        [m.id, m.code, m.name, m.active ? 1 : 0, JSON.stringify(m.roles)],
      );
    }
    await this.saveCatalogs(dataset.catalogs);
    await this.saveSources(dataset.sources);

    for (const cn of dataset.connectors) {
      await this.client.execute(
        `INSERT OR REPLACE INTO connectors (
          id, canonical_code, code, manufacturer_id, name, aliases,
          manufacturer_mappings, description, notes, source_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cn.id,
          cn.canonicalCode,
          cn.code,
          cn.manufacturerId,
          cn.name,
          JSON.stringify(cn.aliases),
          JSON.stringify(cn.manufacturerMappings),
          cn.description ?? null,
          cn.notes ?? null,
          JSON.stringify(cn.sourceIds),
        ],
      );
    }

    for (const ce of dataset.connectorEquivalences) {
      await this.client.execute(
        'INSERT OR REPLACE INTO connector_equivalences (id, connector_a_id, connector_b_id, type, source_ids, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [ce.id, ce.connectorAId, ce.connectorBId, ce.type, JSON.stringify(ce.sourceIds), ce.notes ?? null],
      );
    }

    await this.saveVehicles(dataset.vehicles);
    await this.saveApplications(dataset.applications);
    await this.saveProducts(dataset.products);
    await this.saveFits(dataset.fits);
    await this.saveEquivalences(dataset.equivalences);

    for (const imp of dataset.imports) {
      await this.client.execute(
        `INSERT OR REPLACE INTO imports (
          import_id, source, manufacturer, catalog_year, import_date, status,
          record_count, error_count, warning_count, excluded_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          imp.importId,
          imp.source,
          imp.manufacturer,
          imp.catalogYear,
          imp.importDate,
          imp.status,
          imp.recordCount,
          imp.errorCount,
          imp.warningCount,
          imp.excludedCount,
        ],
      );
    }
  }

  async getDatasetSummary(): Promise<{
    vehiclesCount: number;
    productsCount: number;
    applicationsCount: number;
    fitsCount: number;
    sourcesCount: number;
    manufacturersCount: number;
  }> {
    const [v, p, a, f, s, m] = await Promise.all([
      this.countVehicles(),
      this.countProducts(),
      this.countApplications(),
      this.client.select<{ c: number }>('SELECT COUNT(*) as c FROM fits').then((r) => r[0]?.c ?? 0),
      this.client.select<{ c: number }>('SELECT COUNT(*) as c FROM sources').then((r) => r[0]?.c ?? 0),
      this.client.select<{ c: number }>('SELECT COUNT(*) as c FROM manufacturers').then((r) => r[0]?.c ?? 0),
    ]);

    return {
      vehiclesCount: v,
      productsCount: p,
      applicationsCount: a,
      fitsCount: f,
      sourcesCount: s,
      manufacturersCount: m,
    };
  }

  async exportDataset(): Promise<CatalogDataset> {
    const [
      mRows,
      cRows,
      sRows,
      cnRows,
      ceRows,
      vRows,
      aRows,
      pRows,
      fRows,
      eRows,
      iRows,
    ] = await Promise.all([
      this.client.select<any>('SELECT * FROM manufacturers'),
      this.client.select<any>('SELECT * FROM catalogs'),
      this.client.select<any>('SELECT * FROM sources'),
      this.client.select<any>('SELECT * FROM connectors'),
      this.client.select<any>('SELECT * FROM connector_equivalences'),
      this.client.select<any>('SELECT * FROM vehicles'),
      this.client.select<any>('SELECT * FROM applications'),
      this.client.select<any>('SELECT * FROM products'),
      this.client.select<any>('SELECT * FROM fits'),
      this.client.select<any>('SELECT * FROM equivalences'),
      this.client.select<any>('SELECT * FROM imports'),
    ]);

    return {
      schemaVersion: 1,
      datasetVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      manufacturers: mRows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        active: Boolean(r.active),
        roles: JSON.parse(r.roles),
      })),
      catalogs: cRows.map((r) => ({
        id: r.id,
        manufacturerId: r.manufacturer_id,
        catalogName: r.catalog_name,
        catalogYear: r.catalog_year,
        fileName: r.file_name,
        sha256: r.sha256 ?? null,
        pageCount: r.page_count ?? null,
      })),
      sources: sRows.map((r) => this.mapSourceRow(r)),
      connectors: cnRows.map((r) => ({
        id: r.id,
        canonicalCode: r.canonical_code,
        code: r.code,
        manufacturerId: r.manufacturer_id,
        name: r.name,
        aliases: JSON.parse(r.aliases),
        manufacturerMappings: JSON.parse(r.manufacturer_mappings),
        description: r.description ?? undefined,
        notes: r.notes ?? undefined,
        sourceIds: JSON.parse(r.source_ids),
      })),
      connectorEquivalences: ceRows.map((r) => ({
        id: r.id,
        connectorAId: r.connector_a_id,
        connectorBId: r.connector_b_id,
        type: r.type,
        sourceIds: JSON.parse(r.source_ids),
        notes: r.notes ?? undefined,
      })),
      vehicles: vRows.map((r) => this.mapVehicleRow(r)),
      applications: aRows.map((r) => this.mapApplicationRow(r)),
      products: pRows.map((r) => this.mapProductRow(r)),
      fits: fRows.map((r) => ({
        id: r.id,
        vehicleApplicationId: r.vehicle_application_id,
        brandProductId: r.brand_product_id,
        relationType: r.relation_type,
        sourceIds: JSON.parse(r.source_ids),
        notes: r.notes ?? undefined,
      })),
      equivalences: eRows.map((r) => ({
        id: r.id,
        productAId: r.product_a_id,
        productBId: r.product_b_id,
        relationType: 'documented_equivalence',
        sourceIds: JSON.parse(r.source_ids),
        notes: r.notes ?? undefined,
      })),
      imports: iRows.map((r) => ({
        importId: r.import_id,
        source: r.source,
        manufacturer: r.manufacturer,
        catalogYear: r.catalog_year,
        importDate: r.import_date,
        status: r.status,
        recordCount: r.record_count,
        errorCount: r.error_count,
        warningCount: r.warning_count,
        excludedCount: r.excluded_count,
      })),
    };
  }

  async clearAll(): Promise<void> {
    await this.client.execute('DELETE FROM equivalences');
    await this.client.execute('DELETE FROM fits');
    await this.client.execute('DELETE FROM applications');
    await this.client.execute('DELETE FROM products');
    await this.client.execute('DELETE FROM vehicles');
    await this.client.execute('DELETE FROM connector_equivalences');
    await this.client.execute('DELETE FROM connectors');
    await this.client.execute('DELETE FROM sources');
    await this.client.execute('DELETE FROM catalogs');
    await this.client.execute('DELETE FROM manufacturers');
    await this.client.execute('DELETE FROM imports');
  }

  /* ---------------------------------------------------------------- */
  /* Helpers de Mapeamento                                            */
  /* ---------------------------------------------------------------- */

  private mapVehicleRow(r: any): Vehicle {
    return {
      id: r.id,
      manufacturerId: r.manufacturer_id,
      brand: r.brand,
      model: r.model,
      generation: r.generation ?? undefined,
      variant: r.variant ?? undefined,
      bodyStyle: r.body_style ?? undefined,
      category: r.category,
      yearStart: r.year_start !== null ? Number(r.year_start) : null,
      yearEnd: r.year_end !== null ? Number(r.year_end) : null,
      yearEndOpen: Boolean(r.year_end_open),
      yearRaw: r.year_raw,
      notes: r.notes ?? undefined,
      sourceIds: JSON.parse(r.source_ids),
    };
  }

  private mapProductRow(r: any): BrandProduct {
    return {
      id: r.id,
      manufacturerId: r.manufacturer_id,
      code: r.code,
      family: r.family ?? undefined,
      subfamily: r.subfamily ?? undefined,
      construction: r.construction ?? undefined,
      packageType: r.package_type ?? undefined,
      inches: JSON.parse(r.inches),
      millimeters: JSON.parse(r.millimeters),
      armCompatibility: JSON.parse(r.arm_compatibility),
      applicationScope: r.application_scope ?? undefined,
      mainApplicationsText: r.main_applications_text ?? undefined,
      notes: r.notes ?? undefined,
      sourceIds: JSON.parse(r.source_ids),
    };
  }

  private mapApplicationRow(r: any): VehicleApplication {
    return {
      id: r.id,
      vehicleId: r.vehicle_id,
      position: r.position,
      inches: r.inches !== null ? Number(r.inches) : null,
      millimeters: r.millimeters !== null ? Number(r.millimeters) : null,
      sourceInches: r.source_inches !== null ? Number(r.source_inches) : null,
      sourceMillimeters: r.source_millimeters !== null ? Number(r.source_millimeters) : null,
      calculatedMillimeters: r.calculated_millimeters !== null ? Number(r.calculated_millimeters) : null,
      sizeLabel: r.size_label ?? null,
      measureOrigin: r.measure_origin,
      connectorId: r.connector_id ?? undefined,
      connectorRaw: r.connector_raw ?? undefined,
      notes: r.notes ?? undefined,
      sourceIds: JSON.parse(r.source_ids),
    };
  }

  private mapSourceRow(r: any): CatalogSource {
    return {
      id: r.id,
      catalogId: r.catalog_id,
      manufacturer: r.manufacturer,
      catalogName: r.catalog_name,
      catalogYear: r.catalog_year,
      page: r.page,
      section: r.section ?? undefined,
      sourceReference: r.source_reference ?? undefined,
    };
  }
}
