/**
 * PROTEÇÃO CONTRA LINHA PESADA.
 *
 * Duas barreiras independentes (ambas obrigatórias):
 *  1. `isAllowedVehicleCategory` — a categoria atribuída pela seção da fonte
 *     precisa ser de linha leve.
 *  2. `detectHeavyLine` — inspeção do texto (modelo, variante, seção) contra
 *     termos de linha pesada/máquinas. Mesmo que a seção seja "leve", um
 *     registro com termo pesado é excluído.
 *
 * Usado na importação, normalização, validação, repositório e testes.
 */
import type { VehicleCategory } from './types';
import { ALLOWED_VEHICLE_CATEGORIES } from './types';
import { normalizeText } from './normalize';

/** Categorias de seção encontradas nas fontes, inclusive as proibidas. */
export type SourceSectionCategory =
  | VehicleCategory
  | 'caminhao'
  | 'onibus'
  | 'agricola_maquinas'
  | 'fora_de_escopo';

export function isAllowedVehicleCategory(category: string | null | undefined): category is VehicleCategory {
  return !!category && (ALLOWED_VEHICLE_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Termos (normalizados) que caracterizam linha pesada, ônibus ou máquinas.
 * Comparação por palavra inteira sobre texto normalizado.
 */
export const HEAVY_LINE_TERMS: readonly string[] = [
  'caminhao',
  'caminhoes',
  'onibus',
  'micro onibus',
  'microonibus',
  'trator',
  'tratores',
  'colheitadeira',
  'colheitadeiras',
  'escavadeira',
  'retroescavadeira',
  'pa carregadeira',
  'carregadeira',
  'mini carregadeira',
  'motoniveladora',
  'rolo compactador',
  'empilhadeira',
  'pulverizador',
  'manipulador de materiais',
  'maquina',
  'maquinas',
  'agricola',
  'trolebus',
  'metro',
  'cara chata',
];

export interface HeavyLineCheck {
  heavy: boolean;
  term?: string;
}

/** Detecta termo de linha pesada em qualquer dos textos fornecidos. */
export function detectHeavyLine(...texts: Array<string | null | undefined>): HeavyLineCheck {
  for (const t of texts) {
    if (!t) continue;
    const n = ` ${normalizeText(t)} `;
    for (const term of HEAVY_LINE_TERMS) {
      if (n.includes(` ${term} `)) return { heavy: true, term };
    }
  }
  return { heavy: false };
}

/**
 * Decisão final de admissão de um registro de veículo.
 * Retorna motivo de exclusão ou `null` quando admitido.
 */
export function vehicleExclusionReason(
  sectionCategory: SourceSectionCategory,
  ...texts: Array<string | null | undefined>
): string | null {
  if (!isAllowedVehicleCategory(sectionCategory)) {
    return `seção fora do segmento leve (${sectionCategory})`;
  }
  const check = detectHeavyLine(...texts);
  if (check.heavy) return `termo de linha pesada detectado: "${check.term}"`;
  return null;
}
