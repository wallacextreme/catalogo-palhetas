/**
 * Interpretação de faixas de ano conforme impressas nos catálogos.
 *
 * Formatos reconhecidos:
 *  - Dyna:  "10 / 12", "13 / -", "- / -"
 *  - Vetor: "97>01", "11>25", "13>"
 *  - CINOY: "2014/2019", "2017>", "2018>2019", "2011", "****"
 *
 * Anos de 2 dígitos: yy <= (anoCatálogo % 100) + 1 → 20yy; senão 19yy.
 * Qualquer formato não reconhecido retorna `valid: false` com o problema —
 * NUNCA corrige silenciosamente (ex.: "19911/2000" permanece inválido).
 */

export interface YearRange {
  yearStart: number | null;
  yearEnd: number | null;
  yearEndOpen: boolean;
  valid: boolean;
  issue?: string;
}

export const MIN_VEHICLE_YEAR = 1940;

function expandYear(token: string, catalogYear: number): number | null {
  if (/^\d{4}$/.test(token)) return Number(token);
  if (/^\d{2}$/.test(token)) {
    const yy = Number(token);
    const pivot = (catalogYear % 100) + 1;
    return yy <= pivot ? 2000 + yy : 1900 + yy;
  }
  return null;
}

function checkBounds(r: YearRange, catalogYear: number): YearRange {
  const max = catalogYear + 2;
  for (const y of [r.yearStart, r.yearEnd]) {
    if (y !== null && (y < MIN_VEHICLE_YEAR || y > max)) {
      return { ...r, valid: false, issue: `ano fora da faixa plausível (${y})` };
    }
  }
  if (r.yearStart !== null && r.yearEnd !== null && r.yearEnd < r.yearStart) {
    return { ...r, valid: false, issue: `ano final menor que inicial (${r.yearStart} > ${r.yearEnd})` };
  }
  return r;
}

export function parseYearRange(raw: string, catalogYear: number): YearRange {
  const text = raw.trim().replace(/\s+/g, ' ');
  const notInformed: YearRange = { yearStart: null, yearEnd: null, yearEndOpen: false, valid: true };

  if (text === '' || /^\*+$/.test(text) || /^-\s*\/\s*-$/.test(text) || text === '-') {
    return notInformed;
  }

  // "2019>" / "13>" — aberto
  let m = text.match(/^(\d{2}|\d{4})\s*>$/);
  if (m) {
    const ys = expandYear(m[1]!, catalogYear);
    return checkBounds({ yearStart: ys, yearEnd: null, yearEndOpen: true, valid: ys !== null }, catalogYear);
  }

  // "a / b", "a>b", "a / -"
  m = text.match(/^(\d{2}|\d{4})\s*[/>]\s*(\d{2}|\d{4}|-)$/);
  if (m) {
    const ys = expandYear(m[1]!, catalogYear);
    if (m[2] === '-') {
      return checkBounds({ yearStart: ys, yearEnd: null, yearEndOpen: true, valid: ys !== null }, catalogYear);
    }
    const ye = expandYear(m[2]!, catalogYear);
    return checkBounds({ yearStart: ys, yearEnd: ye, yearEndOpen: false, valid: ys !== null && ye !== null }, catalogYear);
  }

  // "- / 12" — início não informado
  m = text.match(/^-\s*\/\s*(\d{2}|\d{4})$/);
  if (m) {
    const ye = expandYear(m[1]!, catalogYear);
    return checkBounds({ yearStart: null, yearEnd: ye, yearEndOpen: false, valid: ye !== null }, catalogYear);
  }

  // Ano único "2011"
  m = text.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return checkBounds({ yearStart: y, yearEnd: y, yearEndOpen: false, valid: true }, catalogYear);
  }

  return { yearStart: null, yearEnd: null, yearEndOpen: false, valid: false, issue: `formato de ano não reconhecido: "${raw}"` };
}

/** Sobreposição de faixas. Faixa aberta vai até `openEnd`. Desconhecido → `null` (não confirmável). */
export function yearRangesOverlap(
  a: { yearStart: number | null; yearEnd: number | null; yearEndOpen: boolean },
  b: { yearStart: number | null; yearEnd: number | null; yearEndOpen: boolean },
  openEnd = 9999,
): boolean | null {
  if (a.yearStart === null || b.yearStart === null) return null;
  const aEnd = a.yearEnd ?? (a.yearEndOpen ? openEnd : null);
  const bEnd = b.yearEnd ?? (b.yearEndOpen ? openEnd : null);
  if (aEnd === null || bEnd === null) return null;
  return a.yearStart <= bEnd && b.yearStart <= aEnd;
}

/** O ano `year` está coberto pela faixa? `null` quando a faixa é desconhecida. */
export function yearInRange(
  year: number,
  r: { yearStart: number | null; yearEnd: number | null; yearEndOpen: boolean },
): boolean | null {
  if (r.yearStart === null) return null;
  if (year < r.yearStart) return false;
  if (r.yearEnd !== null) return year <= r.yearEnd;
  return r.yearEndOpen ? true : year === r.yearStart;
}

export function formatYearRange(r: { yearStart: number | null; yearEnd: number | null; yearEndOpen: boolean }): string {
  if (r.yearStart === null && r.yearEnd === null) return 'Não informado';
  const s = r.yearStart ?? '?';
  if (r.yearEnd !== null) return r.yearEnd === r.yearStart ? `${s}` : `${s} → ${r.yearEnd}`;
  return r.yearEndOpen ? `${s} → ...` : `${s}`;
}
