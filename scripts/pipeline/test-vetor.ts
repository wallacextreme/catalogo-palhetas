import rawVetor from '../../data/raw/vetor-2025.raw.json';

console.log('Total páginas Vetor no raw:', rawVetor.pages.length);

for (const pageNum of [6, 7, 27, 28, 61]) {
  const p = rawVetor.pages.find((page) => page.page === pageNum);
  if (!p) {
    console.log(`Página ${pageNum} não encontrada`);
    continue;
  }
  console.log(`\n=== Vetor Página ${pageNum} (${p.spans.length} spans) ===`);

  // Agrupar spans por linha Y
  const rows: Array<{ y: number; spans: typeof p.spans }> = [];
  for (const span of [...p.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    if (span.y0 < 80) continue;
    let row = rows.find((r) => Math.abs(r.y - span.y0) <= 2.5);
    if (!row) {
      row = { y: span.y0, spans: [] };
      rows.push(row);
    }
    row.spans.push(span);
  }

  for (const r of rows.slice(0, 15)) {
    const text = r.spans
      .sort((a, b) => a.x0 - b.x0)
      .map((s) => `${s.x0.toFixed(0)}:${s.t.trim()}`)
      .filter((s) => !s.endsWith(':'))
      .join(' | ');
    if (text.length > 5) {
      console.log(`  [y=${r.y.toFixed(1)}] ${text}`);
    }
  }
}
