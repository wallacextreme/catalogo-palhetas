-- SCHEMA RELACIONAL SQLITE - CATÁLOGO DE PALHETAS
-- Projetado para Tauri v2 + @tauri-apps/plugin-sql / SQLite nativo
-- Versionado com tabela schema_migrations. Sem operações destrutivas.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,
    description TEXT NOT NULL
);

-- Migração 1: Estrutura inicial
CREATE TABLE IF NOT EXISTS manufacturers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    roles TEXT NOT NULL -- JSON array ['vehicle', 'wiper_blade']
);

CREATE TABLE IF NOT EXISTS catalogs (
    id TEXT PRIMARY KEY,
    manufacturer_id TEXT NOT NULL,
    catalog_name TEXT NOT NULL,
    catalog_year INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    sha256 TEXT,
    page_count INTEGER,
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    catalog_name TEXT NOT NULL,
    catalog_year INTEGER NOT NULL,
    page INTEGER NOT NULL,
    section TEXT,
    source_reference TEXT,
    FOREIGN KEY (catalog_id) REFERENCES catalogs(id)
);

CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    canonical_code TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL,
    manufacturer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL, -- JSON array
    manufacturer_mappings TEXT NOT NULL, -- JSON object
    description TEXT,
    notes TEXT,
    source_ids TEXT NOT NULL, -- JSON array
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
);

CREATE TABLE IF NOT EXISTS connector_equivalences (
    id TEXT PRIMARY KEY,
    connector_a_id TEXT NOT NULL,
    connector_b_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'documented' | 'derived'
    source_ids TEXT NOT NULL, -- JSON array
    notes TEXT,
    FOREIGN KEY (connector_a_id) REFERENCES connectors(id),
    FOREIGN KEY (connector_b_id) REFERENCES connectors(id)
);

CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    manufacturer_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    generation TEXT,
    variant TEXT,
    body_style TEXT,
    category TEXT NOT NULL, -- 'passeio' | 'utilitario_leve' | 'van_leve' | 'linha_leve'
    year_start INTEGER,
    year_end INTEGER,
    year_end_open INTEGER NOT NULL DEFAULT 0,
    year_raw TEXT NOT NULL,
    notes TEXT,
    source_ids TEXT NOT NULL, -- JSON array
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    position TEXT NOT NULL, -- 'motorista' | 'passageiro' | 'par_dianteiro' | 'traseira'
    inches REAL,
    millimeters REAL,
    source_inches REAL,
    source_millimeters REAL,
    calculated_millimeters REAL,
    size_label TEXT,
    measure_origin TEXT NOT NULL,
    connector_id TEXT,
    connector_raw TEXT,
    notes TEXT,
    source_ids TEXT NOT NULL, -- JSON array
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (connector_id) REFERENCES connectors(id)
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    manufacturer_id TEXT NOT NULL,
    code TEXT NOT NULL,
    compact_code TEXT NOT NULL,
    family TEXT,
    subfamily TEXT,
    construction TEXT,
    package_type TEXT,
    inches TEXT NOT NULL, -- JSON array
    millimeters TEXT NOT NULL, -- JSON array
    arm_compatibility TEXT NOT NULL, -- JSON array
    application_scope TEXT,
    main_applications_text TEXT,
    notes TEXT,
    source_ids TEXT NOT NULL, -- JSON array
    FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id)
);

CREATE TABLE IF NOT EXISTS fits (
    id TEXT PRIMARY KEY,
    vehicle_application_id TEXT NOT NULL,
    brand_product_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    source_ids TEXT NOT NULL, -- JSON array
    notes TEXT,
    FOREIGN KEY (vehicle_application_id) REFERENCES applications(id),
    FOREIGN KEY (brand_product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS equivalences (
    id TEXT PRIMARY KEY,
    product_a_id TEXT NOT NULL,
    product_b_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'documented_equivalence',
    source_ids TEXT NOT NULL, -- JSON array
    notes TEXT,
    FOREIGN KEY (product_a_id) REFERENCES products(id),
    FOREIGN KEY (product_b_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS imports (
    import_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    catalog_year INTEGER NOT NULL,
    import_date TEXT NOT NULL,
    status TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    error_count INTEGER NOT NULL,
    warning_count INTEGER NOT NULL,
    excluded_count INTEGER NOT NULL
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_vehicles_brand_model ON vehicles(brand, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category);
CREATE INDEX IF NOT EXISTS idx_applications_vehicle ON applications(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_products_compact_code ON products(compact_code);
CREATE INDEX IF NOT EXISTS idx_fits_application ON fits(vehicle_application_id);
CREATE INDEX IF NOT EXISTS idx_fits_product ON fits(brand_product_id);

INSERT OR IGNORE INTO schema_migrations (version, applied_at, description)
VALUES (1, CURRENT_TIMESTAMP, 'Initial schema with vehicles, applications, products, and cross-references');
