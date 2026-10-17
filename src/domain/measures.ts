/**
 * Medidas. Regra: 1 polegada = 25,4 mm. Valores originais são preservados;
 * o cálculo só preenche `calculatedMillimeters`.
 */

export const MM_PER_INCH = 25.4;

export function inchesToMillimeters(inches: number): number {
  return Math.round(inches * MM_PER_INCH * 10) / 10;
}

export function millimetersToInches(mm: number): number {
  return Math.round(mm / MM_PER_INCH);
}

export function resolveMillimeters(inches: number | null, millimeters: number | null): number | null {
  if (millimeters !== null && Number.isFinite(millimeters)) return millimeters;
  if (inches !== null && Number.isFinite(inches)) return Math.round(inches * MM_PER_INCH);
  return null;
}

/** Faixa plausível de palheta automotiva leve (polegadas). Fora disso = medida inválida. */
export const MIN_BLADE_INCHES = 8;
export const MAX_BLADE_INCHES = 34;

export function isPlausibleBladeInches(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_BLADE_INCHES && value <= MAX_BLADE_INCHES;
}

/**
 * Converte uma medida impressa em polegadas. Aceita `24"`, `24”`, `10,5"`, `10.5`.
 * Retorna `null` se o texto não for uma medida reconhecível (nunca adivinha).
 */
export function parseInches(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?:[.,](\d))?\s*(?:["”″'']{1,2}|pol)?$/i);
  if (!m) return null;
  const value = Number(`${m[1]}${m[2] ? `.${m[2]}` : ''}`);
  return Number.isFinite(value) ? value : null;
}

/** Extrai uma lista de polegadas de um texto como `24"/14"` ou `20”/18”`. */
export function parseInchesList(raw: string): number[] | null {
  const parts = raw.split('/').map((p) => parseInches(p));
  if (parts.length === 0 || parts.some((p) => p === null)) return null;
  return parts as number[];
}

/** Extrai uma lista de milímetros de um texto como `600/350` ou `355,60mm`. */
export function parseMillimetersList(raw: string): number[] | null {
  const cleaned = raw.replace(/mm/gi, '').trim();
  const parts = cleaned.split('/').map((p) => {
    const m = p.trim().match(/^(\d{2,4})(?:[.,](\d{1,2}))?$/);
    return m ? Number(`${m[1]}${m[2] ? `.${m[2]}` : ''}`) : null;
  });
  if (parts.length === 0 || parts.some((p) => p === null)) return null;
  return parts as number[];
}

/** Formata medida para exibição pt-BR: 609.6 → "609,6". */
export function formatMillimeters(mm: number): string {
  return mm.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function formatInches(inches: number): string {
  return `${inches.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}"`;
}
