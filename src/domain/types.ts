/**
 * MODELO DE DOMÍNIO — Catálogo técnico de palhetas.
 *
 * Princípios (ver docs/DATA_GOVERNANCE.md):
 *  - Nenhum dado é inventado: ausência = `null` (exibido como "Não informado").
 *  - Todo registro relevante carrega `sourceIds` (rastreabilidade até a página).
 *  - Compatibilidade ≠ Equivalência. "Mesma polegada + mesma conexão" NUNCA
 *    implica "mesmo produto".
 *  - Fabricantes são DADOS (entidade Manufacturer), não enum.
 */

/* ------------------------------------------------------------------ */
/* Fabricantes e fontes                                                */
/* ------------------------------------------------------------------ */

/** Papel de um fabricante no domínio. Um mesmo nome pode ter os dois papéis. */
export type ManufacturerRole = 'vehicle' | 'wiper_blade';

export interface Manufacturer {
  id: string;
  /** Código curto estável em MAIÚSCULAS (ex.: "DYNA", "CHEVROLET"). */
  code: string;
  name: string;
  active: boolean;
  roles: ManufacturerRole[];
}

/** Documento-fonte (o PDF como um todo). */
export interface Catalog {
  id: string;
  manufacturerId: string;
  /** Nome do catálogo conforme a fonte. */
  catalogName: string;
  /** Ano REAL da fonte (não o ano corrente). */
  catalogYear: number;
  fileName: string;
  /** SHA-256 do PDF usado na extração (auditoria). */
  sha256: string | null;
  pageCount: number | null;
}

/** Referência rastreável até a página/seção de um catálogo. */
export interface CatalogSource {
  id: string;
  catalogId: string;
  manufacturer: string;
  catalogName: string;
  catalogYear: number;
  page: number;
  section?: string;
  sourceReference?: string;
}

/* ------------------------------------------------------------------ */
/* Veículos                                                            */
/* ------------------------------------------------------------------ */

/**
 * Categoria do veículo. Somente linha leve é admitida no dataset.
 * `linha_leve` = a fonte não distingue automóvel de utilitário
 * (ex.: Dyna "LINHA LEVE: AUTOMÓVEIS E UTILITÁRIOS").
 */
export type VehicleCategory =
  | 'passeio'
  | 'utilitario_leve'
  | 'van_leve'
  | 'linha_leve';

export const ALLOWED_VEHICLE_CATEGORIES: readonly VehicleCategory[] = [
  'passeio',
  'utilitario_leve',
  'van_leve',
  'linha_leve',
] as const;

export interface Vehicle {
  id: string;
  /** Manufacturer (papel 'vehicle'). */
  manufacturerId: string;
  /** Nome da marca como exibido (ex.: "Chevrolet"). */
  brand: string;
  /** Modelo conforme a fonte (preserva grafia original). */
  model: string;
  generation?: string;
  /** Observação/variante impressa junto ao modelo (ex.: "palhetas Slim Blade"). */
  variant?: string;
  bodyStyle?: string;
  category: VehicleCategory;
  /** `null` quando a fonte não informa (ex.: CINOY "****"). */
  yearStart: number | null;
  /** `null` = aberto ("→ ...") ou não informado; ver `yearEndOpen`. */
  yearEnd: number | null;
  /** true quando a fonte indica faixa aberta (ex.: "19 / -", "2019>"). */
  yearEndOpen: boolean;
  /** Texto de ano exatamente como impresso. */
  yearRaw: string;
  notes?: string;
  sourceIds: string[];
}

/* ------------------------------------------------------------------ */
/* Posições, medidas e conexões                                        */
/* ------------------------------------------------------------------ */

export type Position = 'motorista' | 'passageiro' | 'par_dianteiro' | 'traseira';

export const POSITIONS: readonly Position[] = [
  'motorista',
  'passageiro',
  'par_dianteiro',
  'traseira',
] as const;

/**
 * Conector (sistema de conexão/encaixe). A terminologia original do
 * fabricante é preservada. Equivalências ENTRE fabricantes só existem em
 * `ConnectorEquivalence` com fonte ou marcadas explicitamente como derivadas.
 */
export interface Connector {
  id: string;
  /** Código canônico = `${FABRICANTE}:${código original}` (ex.: "DYNA:TL1"). */
  canonicalCode: string;
  /** Código original como impresso (ex.: "TL1", "B", "05"). */
  code: string;
  /** Fabricante dono da terminologia. */
  manufacturerId: string;
  name: string;
  aliases: string[];
  /** Terminologia por fabricante: { DYNA: ["TL1"] }. Nunca cruza fabricantes sem fonte. */
  manufacturerMappings: Record<string, string[]>;
  /** Descrição técnica impressa na fonte (ex.: "Top-Lock 19mm"). */
  description?: string;
  notes?: string;
  sourceIds: string[];
}

export type ConnectorEquivalenceType = 'documented' | 'derived';

export interface ConnectorEquivalence {
  id: string;
  connectorAId: string;
  connectorBId: string;
  type: ConnectorEquivalenceType;
  /** Obrigatório para 'documented'. */
  sourceIds: string[];
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Aplicação técnica                                                   */
/* ------------------------------------------------------------------ */

/** De onde veio a medida da aplicação. */
export type MeasureOrigin =
  /** Medida impressa na própria linha de aplicação (CINOY, Vetor). */
  | 'application_table'
  /** Medida obtida da tabela de produtos do mesmo catálogo (Dyna p.37–39). */
  | 'product_table'
  /** Fonte não informa. */
  | 'not_informed';

export interface VehicleApplication {
  id: string;
  vehicleId: string;
  position: Position;
  /**
   * Medida única da aplicação. `null` quando não informada ou quando a
   * aplicação é um par com medidas distintas sem atribuição motorista/passageiro
   * documentada (ver `sizeLabel`).
   */
  inches: number | null;
  millimeters: number | null;
  /** Valores exatamente como na fonte (auditoria). */
  sourceInches: number | null;
  sourceMillimeters: number | null;
  /** Calculado (1" = 25,4 mm) apenas quando a fonte não fornece mm. */
  calculatedMillimeters: number | null;
  /** Rótulo de medida original (ex.: `24"/14"`, `600/350`). */
  sizeLabel: string | null;
  measureOrigin: MeasureOrigin;
  connectorId?: string;
  /** Código de conexão como impresso, mesmo quando não resolvido. */
  connectorRaw?: string;
  notes?: string;
  sourceIds: string[];
}

/* ------------------------------------------------------------------ */
/* Produto do fabricante                                               */
/* ------------------------------------------------------------------ */

export type PackageType = 'unitario' | 'par';

export interface BrandProduct {
  id: string;
  /** Manufacturer (papel 'wiper_blade'). */
  manufacturerId: string;
  /** Código exatamente como impresso. */
  code: string;
  /** Família conforme o catálogo (texto livre, não enum fechado). */
  family?: string;
  subfamily?: string;
  construction?: string;
  packageType?: PackageType;
  /** Medidas documentadas (polegadas). Vazio = não informado. */
  inches: number[];
  /** Milímetros documentados na fonte (quando houver). */
  millimeters: number[];
  /** Códigos de conexão documentados para o produto (terminologia original). */
  armCompatibility: string[];
  /** Aplicação impressa pelo fabricante (D = dianteira, T = traseira, D/T). */
  applicationScope?: string;
  /** Texto "principais aplicações" (informativo, não estruturado). */
  mainApplicationsText?: string;
  notes?: string;
  sourceIds: string[];
}

/* ------------------------------------------------------------------ */
/* Fit e Cross-reference                                               */
/* ------------------------------------------------------------------ */

/**
 * Relação entre produtos/aplicações de fabricantes diferentes.
 *  - documented_equivalence: a FONTE declara a equivalência.
 *  - application_match: ambos os catálogos indicam a mesma aplicação
 *    (veículo + posição + anos sobrepostos), sem declaração de equivalência.
 *  - derived_compatibility: obtida por critérios técnicos estruturados
 *    (medida + conector com equivalência registrada). NÃO é equivalência.
 *  - not_confirmed: dados insuficientes ou conflitantes.
 */
export type RelationType =
  | 'documented_equivalence'
  | 'application_match'
  | 'derived_compatibility'
  | 'not_confirmed';

/** Fit de um produto a uma aplicação. */
export type FitRelationType = 'catalog_documented' | RelationType;

export interface ProductFit {
  id: string;
  vehicleApplicationId: string;
  brandProductId: string;
  /**
   * 'catalog_documented' = o catálogo do próprio fabricante do produto lista
   * o produto para essa aplicação (fato da fonte).
   */
  relationType: FitRelationType;
  sourceIds: string[];
  notes?: string;
}

/** Equivalência produto↔produto declarada por fonte (persistida). */
export interface ProductEquivalence {
  id: string;
  productAId: string;
  productBId: string;
  relationType: 'documented_equivalence';
  sourceIds: string[];
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Importação / auditoria                                              */
/* ------------------------------------------------------------------ */

export type ImportStatus = 'success' | 'success_with_warnings' | 'failed';

export interface ImportRecord {
  importId: string;
  source: string;
  manufacturer: string;
  catalogYear: number;
  importDate: string;
  status: ImportStatus;
  recordCount: number;
  errorCount: number;
  warningCount: number;
  excludedCount: number;
}

/** Registro descartado na ingestão (ex.: linha pesada) — mantido para auditoria. */
export interface ExcludedRecord {
  sourceId: string;
  reason: string;
  rawText: string;
}

/** Dataset oficial completo (formato de intercâmbio JSON). */
export interface CatalogDataset {
  schemaVersion: number;
  datasetVersion: string;
  generatedAt: string;
  manufacturers: Manufacturer[];
  catalogs: Catalog[];
  sources: CatalogSource[];
  connectors: Connector[];
  connectorEquivalences: ConnectorEquivalence[];
  vehicles: Vehicle[];
  applications: VehicleApplication[];
  products: BrandProduct[];
  fits: ProductFit[];
  equivalences: ProductEquivalence[];
  imports: ImportRecord[];
}

export const DATASET_SCHEMA_VERSION = 1;
