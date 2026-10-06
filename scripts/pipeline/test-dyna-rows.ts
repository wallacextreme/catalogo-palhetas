// Teste rápido do agrupador de linhas Dyna
import rawDyna from '../../data/raw/dyna-2025.raw.json';

const p6 = rawDyna.pages.find((p) => p.page === 6)!;
console.log('Página 6 spans:', p6.spans.length);

// Agrupar spans por y0 similar (tolerância de 2.5px)
const rows: Array<{ y: number; spans: typeof p6.spans }> = [];
const sortedSpans = [...p6.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

for (const span of sortedSpans) {
  if (span.y0 < 95) continue; // cabeçalho
  let row = rows.find((r) => Math.abs(r.y - span.y0) <= 2.5);
  if (!row) {
    row = { y: span.y0, spans: [] };
    rows.push(row);
  }
  row.spans.push(span);
}

console.log('Linhas detectadas:', rows.length);
for (const r of rows.slice(0, 15)) {
  const line = r.spans
    .sort((a, b) => a.x0 - b.x0)
    .map((s) => `${s.x0.toFixed(0)}:${s.t}`)
    .join(' | ');
  console.log(`y=${r.y.toFixed(1)} -> ${line}`);
}
