/**
 * Normalização textual compartilhada (busca, chaves de deduplicação).
 * Remove acentos, unifica caixa, espaços, hífens, barras e caracteres especiais.
 * NUNCA é usada para sobrescrever o valor original exibido.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Texto normalizado para comparação: minúsculo, sem acento, separadores → espaço. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[’”″"“]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Forma compacta (sem separadores) — usada para códigos: "YN-PS2416B" → "ynps2416b". */
export function compactCode(input: string): string {
  return normalizeText(input).replace(/\s+/g, '');
}

/** Tokens normalizados. */
export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(' ') : [];
}

/** Chave estável para comparação de nomes de modelo/marca. */
export function nameKey(input: string): string {
  return normalizeText(input);
}

const PRESERVED_ACRONYMS = new Set(['SW4', 'BMW', 'GWM', 'BYD', 'JAC', 'JPX', 'SUV', '4X4']);

/** Capitaliza nomes de marca e modelos impressos em MAIÚSCULAS preservando siglas automotivas. */
export function titleCase(input: string): string {
  return input
    .split(/(\s+|-|\/)/)
    .map((part) => {
      const upper = part.toUpperCase();
      if (PRESERVED_ACRONYMS.has(upper)) return upper;
      const lower = part.toLowerCase();
      return lower.length > 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join('');
}
