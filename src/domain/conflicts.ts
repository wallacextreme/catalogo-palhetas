import type {
  CatalogDataset,
  Vehicle,
  VehicleApplication,
  Position,
} from './types';
import { normalizeText } from './normalize';
import { extractModelMetadata } from './consolidation';
import { canonicalizeManufacturer } from './manufacturers';
import { yearRangesOverlap } from './years';

export type ConflictClassification =
  | 'same_application_multicatalog'
  | 'technical_variant'
  | 'connector_variant'
  | 'dimension_variant'
  | 'dimension_and_connector_variant'
  | 'source_conflict'
  | 'possible_source_error'
  | 'duplicate_commercial_entry'
  | 'ambiguous';

export type ConflictPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export type RecommendedAction =
  | 'KEEP_SEPARATE'
  | 'MERGE_AS_CROSS_REFERENCE'
  | 'DISPLAY_WARNING'
  | 'REVIEW_SOURCE'
  | 'REVIEW_HUMAN'
  | 'IGNORE_LEGITIMATE_DIFFERENCE';

export interface TechnicalConflictRecord {
  id: string;
  familyKey: string;
  brand: string;
  family: string;
  position: Position | string;
  classification: ConflictClassification;
  priority: ConflictPriority;
  yearRange: string;
  vehicleA: {
    id: string;
    model: string;
    years: string;
    yearStart: number | null;
    yearEnd: number | null;
    sourceIds: string[];
  };
  vehicleB: {
    id: string;
    model: string;
    years: string;
    yearStart: number | null;
    yearEnd: number | null;
    sourceIds: string[];
  };
  appA: {
    inches: number | null;
    millimeters: number | null;
    connector?: string;
  };
  appB: {
    inches: number | null;
    millimeters: number | null;
    connector?: string;
  };
  dimensions?: {
    inchesA: number | null;
    inchesB: number | null;
    deltaInches: number | null;
  };
  connectors?: {
    connectorA?: string;
    connectorB?: string;
    isCompatible: boolean;
  };
  years?: {
    vehicleA: string;
    vehicleB: string;
    overlap: string;
  };
  sourceA?: string[];
  sourceB?: string[];
  explanation?: string;
  description: string;
  evidence: string;
  recommendation: string;
  recommendedAction: RecommendedAction;
}

export type ConflictRecord = TechnicalConflictRecord;

/**
 * Classifica um par de aplicações sobrepostas dentro da mesma família.
 */
export function classifyApplicationPair(
  appA: VehicleApplication,
  appB: VehicleApplication,
  vehicleA: Vehicle,
  vehicleB: Vehicle,
): { classification: ConflictClassification; priority: ConflictPriority; reason: string } {
  // 1. Checagem de Erro Material Evidente na Fonte (Anomalias tipográficas conhecidas nos PDFs)
  const isErrA = isSuspectedSourceError(vehicleA);
  const isErrB = isSuspectedSourceError(vehicleB);
  if (isErrA || isErrB) {
    return {
      classification: 'possible_source_error',
      priority: 'P2',
      reason: 'Registro possui texto de ano corrompido ou anomalia evidente na impressão original.',
    };
  }

  // 2. Checagem de Duplicidade Comercial Intra-Catálogo (asteriscos de silicone, acentuação no mesmo catálogo)
  const isAsteriskA = vehicleA.model.includes('*');
  const isAsteriskB = vehicleB.model.includes('*');
  const sameSource = vehicleA.sourceIds.some((s) => vehicleB.sourceIds.includes(s));
  if ((isAsteriskA !== isAsteriskB) && sameSource) {
    return {
      classification: 'duplicate_commercial_entry',
      priority: 'P3',
      reason: 'Entrada duplicada no mesmo catálogo para distinguir linha comercial (ex: silicone via asterisco).',
    };
  }

  const inchesA = appA.inches;
  const inchesB = appB.inches;
  const connA = normalizeText(appA.connectorRaw || 'padrao');
  const connB = normalizeText(appB.connectorRaw || 'padrao');

  const diffInches = inchesA !== null && inchesB !== null && Math.abs(inchesA - inchesB) >= 1;
  const diffConnector = connA !== connB;

  // 3. Mesma Aplicação Multi-Catálogo (Cross-reference puro: mesma medida e conector)
  if (!diffInches && !diffConnector) {
    return {
      classification: 'same_application_multicatalog',
      priority: 'P4',
      reason: 'Mesma aplicação com medidas e conectores equivalentes documentada por catálogos diferentes.',
    };
  }

  // 4. Variante Técnica Legítima (Diferença de carroceria documentada: Cabine, Sedan, Quadrado, Bolinha, etc.)
  const metaA = extractModelMetadata(vehicleA.model);
  const metaB = extractModelMetadata(vehicleB.model);
  if (metaA.variant !== metaB.variant || metaA.generation !== metaB.generation) {
    return {
      classification: 'technical_variant',
      priority: 'P3',
      reason: `Variante técnica legítima de carroceria ou geração (${metaA.variant || 'Padrão'} vs ${metaB.variant || 'Padrão'}).`,
    };
  }

  // 5. Divergência Simultânea de Medida E Conector
  if (diffInches && diffConnector) {
    return {
      classification: 'dimension_and_connector_variant',
      priority: 'P0',
      reason: 'Divergência dimensional e de encaixe simultânea no mesmo período (alto risco de erro no balcão).',
    };
  }

  // 6. Conflito / Variante de Conector
  if (!diffInches && diffConnector) {
    return {
      classification: 'connector_variant',
      priority: 'P1',
      reason: 'Mesma medida, porém encaixe diferente documentado (verificar braço do veículo).',
    };
  }

  // 7. Conflito / Variante de Medida
  if (diffInches && !diffConnector) {
    // Se a diferença for grande (>= 2 polegadas), risco P0
    const delta = Math.abs((inchesA ?? 0) - (inchesB ?? 0));
    return {
      classification: sameSource ? 'dimension_variant' : 'source_conflict',
      priority: delta >= 2 ? 'P0' : 'P1',
      reason: sameSource
        ? `Variação dimensional de ${delta}" documentada no mesmo catálogo.`
        : `Conflito direto entre fabricantes de palhetas (${inchesA}" vs ${inchesB}").`,
    };
  }

  return {
    classification: 'ambiguous',
    priority: 'P2',
    reason: 'Situação ambígua sem dados suficientes.',
  };
}

/**
 * Detecta erros materiais evidentes nos textos originais dos PDFs.
 */
export function isSuspectedSourceError(v: Vehicle): boolean {
  const yr = v.yearRaw;
  if (!yr) return false;
  if (/\b(?:1015|19911)\b/.test(yr)) return true;
  if (v.yearStart !== null && v.yearEnd !== null && v.yearStart > v.yearEnd) return true;
  if (v.brand === 'Não informada') return true;
  return false;
}

export interface ConflictAuditResult {
  totalPairs: number;
  classifiedPairs: number;
  unclassifiedPairs: number;
  multiCatalogPairs: number;
  conflictRecordsCount: number;
  byClassification: Record<ConflictClassification, number>;
  byPriority: Record<ConflictPriority, number>;
  records: TechnicalConflictRecord[];
}

/**
 * Realiza uma auditoria completa de conflitos em todo o dataset.
 */
export function auditDatasetConflicts(dataset: CatalogDataset): ConflictAuditResult {
  const appsByVehicleId = new Map<string, VehicleApplication[]>();
  for (const app of dataset.applications) {
    if (!appsByVehicleId.has(app.vehicleId)) appsByVehicleId.set(app.vehicleId, []);
    appsByVehicleId.get(app.vehicleId)!.push(app);
  }

  const familyMap = new Map<string, Vehicle[]>();
  for (const v of dataset.vehicles) {
    const brand = canonicalizeManufacturer(v.brand) || v.brand;
    const meta = extractModelMetadata(v.model);
    const key = `${brand}|${meta.family}`;
    if (!familyMap.has(key)) familyMap.set(key, []);
    familyMap.get(key)!.push(v);
  }

  const records: TechnicalConflictRecord[] = [];
  const byClassification: Record<ConflictClassification, number> = {
    same_application_multicatalog: 0,
    technical_variant: 0,
    connector_variant: 0,
    dimension_variant: 0,
    dimension_and_connector_variant: 0,
    source_conflict: 0,
    possible_source_error: 0,
    duplicate_commercial_entry: 0,
    ambiguous: 0,
  };

  const byPriority: Record<ConflictPriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };

  let totalEvaluatedPairs = 0;
  let classifiedPairs = 0;
  let unclassifiedPairs = 0;

  for (const [famKey, vList] of familyMap.entries()) {
    const [brand, family] = famKey.split('|');

    for (let i = 0; i < vList.length; i++) {
      for (let j = i + 1; j < vList.length; j++) {
        const vA = vList[i]!;
        const vB = vList[j]!;

        if (!yearRangesOverlap(vA, vB)) continue;

        const appsA = appsByVehicleId.get(vA.id) || [];
        const appsB = appsByVehicleId.get(vB.id) || [];

        for (const aA of appsA) {
          for (const aB of appsB) {
            if (aA.position !== aB.position) continue;

            totalEvaluatedPairs++;
            const res = classifyApplicationPair(aA, aB, vA, vB);

            if (res && res.classification) {
              classifiedPairs++;
            } else {
              unclassifiedPairs++;
            }

            // Não contabiliza como conflito o que é pura correspondência idêntica
            if (res.classification === 'same_application_multicatalog') {
              byClassification.same_application_multicatalog++;
              byPriority.P4++;
              continue;
            }

            byClassification[res.classification]++;
            byPriority[res.priority]++;

            const start = Math.max(vA.yearStart ?? 1900, vB.yearStart ?? 1900);
            const end = Math.min(vA.yearEnd ?? 2030, vB.yearEnd ?? 2030);

            const recommendedAction = getRecommendedAction(res.classification, res.priority);
            const deltaInches =
              aA.inches !== null && aB.inches !== null ? Math.abs(aA.inches - aB.inches) : null;
            const connA = aA.connectorRaw || 'padrao';
            const connB = aB.connectorRaw || 'padrao';

            records.push({
              id: `conf_${vA.id}_${vB.id}_${aA.position}`,
              familyKey: famKey,
              brand: brand || vA.brand,
              family: family || extractModelMetadata(vA.model).family,
              position: aA.position,
              classification: res.classification,
              priority: res.priority,
              yearRange: `${start} → ${end}`,
              vehicleA: {
                id: vA.id,
                model: vA.model,
                years: vA.yearRaw,
                yearStart: vA.yearStart,
                yearEnd: vA.yearEnd,
                sourceIds: vA.sourceIds,
              },
              vehicleB: {
                id: vB.id,
                model: vB.model,
                years: vB.yearRaw,
                yearStart: vB.yearStart,
                yearEnd: vB.yearEnd,
                sourceIds: vB.sourceIds,
              },
              appA: {
                inches: aA.inches,
                millimeters: aA.millimeters,
                connector: aA.connectorRaw,
              },
              appB: {
                inches: aB.inches,
                millimeters: aB.millimeters,
                connector: aB.connectorRaw,
              },
              dimensions: {
                inchesA: aA.inches,
                inchesB: aB.inches,
                deltaInches,
              },
              connectors: {
                connectorA: aA.connectorRaw,
                connectorB: aB.connectorRaw,
                isCompatible: normalizeText(connA) === normalizeText(connB),
              },
              years: {
                vehicleA: vA.yearRaw,
                vehicleB: vB.yearRaw,
                overlap: `${start} → ${end}`,
              },
              sourceA: vA.sourceIds,
              sourceB: vB.sourceIds,
              explanation: res.reason,
              description: res.reason,
              evidence: `Fonte A: [${vA.sourceIds.join(',')}] | Fonte B: [${vB.sourceIds.join(',')}]`,
              recommendation: getRecommendation(res.classification, res.priority),
              recommendedAction,
            });
          }
        }
      }
    }
  }

  return {
    totalPairs: totalEvaluatedPairs,
    classifiedPairs,
    unclassifiedPairs,
    multiCatalogPairs: byClassification.same_application_multicatalog,
    conflictRecordsCount: records.length,
    byClassification,
    byPriority,
    records,
  };
}

export function getRecommendedAction(
  cls: ConflictClassification,
  priority: ConflictPriority,
): RecommendedAction {
  switch (cls) {
    case 'same_application_multicatalog':
      return 'MERGE_AS_CROSS_REFERENCE';
    case 'technical_variant':
      return 'KEEP_SEPARATE';
    case 'duplicate_commercial_entry':
      return 'IGNORE_LEGITIMATE_DIFFERENCE';
    case 'possible_source_error':
      return 'REVIEW_HUMAN';
    case 'source_conflict':
      return 'DISPLAY_WARNING';
    case 'dimension_and_connector_variant':
      return 'DISPLAY_WARNING';
    case 'connector_variant':
      return 'DISPLAY_WARNING';
    case 'dimension_variant':
      return priority === 'P0' ? 'DISPLAY_WARNING' : 'KEEP_SEPARATE';
    case 'ambiguous':
    default:
      return 'REVIEW_SOURCE';
  }
}

export function getRecommendation(_cls: ConflictClassification, prio: ConflictPriority): string {
  if (prio === 'P0') return 'Exibir ambas as medidas na UI com alerta de conferência de braço/palheta no balcão.';
  if (prio === 'P1') return 'Diferença de 1 polegada ou conector específico: manter variantes discriminadas por fabricante.';
  if (prio === 'P2') return 'Encaminhar para fila de revisão humana documental.';
  if (prio === 'P3') return 'Variante técnica de carroceria ou ciclo documentada: apresentar com badge explícito.';
  return 'Cross-reference multi-catálogo normal.';
}
