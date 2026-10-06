/**
 * IDs estáveis e determinísticos derivados de chaves de conteúdo.
 * Mesma chave → mesmo ID em qualquer reimportação (nunca índice de array).
 */

/** Hash 53-bit (cyrb53) — determinístico, sem dependência de crypto assíncrono. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(36).padStart(11, '0');
}

export type IdPrefix =
  | 'mfr'
  | 'cat'
  | 'src'
  | 'con'
  | 'ceq'
  | 'veh'
  | 'app'
  | 'prd'
  | 'fit'
  | 'fit_cross'
  | 'peq'
  | 'imp';

/** Gera ID estável: `${prefix}_${hash(parts)}`. */
export function stableId(prefix: IdPrefix, ...parts: Array<string | number | null | undefined>): string {
  const key = parts.map((p) => (p === null || p === undefined ? '∅' : String(p))).join('|');
  return `${prefix}_${hash53(key)}`;
}
