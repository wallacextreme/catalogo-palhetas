import rawDyna from '../../data/raw/dyna-2025.raw.json';

for (const pageNum of [37, 38, 39]) {
  const p = rawDyna.pages.find((page) => page.page === pageNum)!;
  console.log(`=== Página ${pageNum} (${p.spans.length} spans) ===`);

  // Agrupar spans por linha Y com tolerância de 3px
  const rows: Array<{ y: number; spans: typeof p.spans }> = [];
  for (const span of [...p.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    if (span.y0 < 90) continue;
    let row = rows.find((r) => Math.abs(r.y - span.y0) <= 3.5);
    if (!row) {
      row = { y: span.y0, spans: [] };
      rows.push(row);
    }
    row.spans.push(span);
  }

  for (const r of rows) {
    const text = r.spans
      .sort((a, b) => a.x0 - b.x0)
      .map((s) => s.t.trim())
      .filter(Boolean)
      .join(' | ');
    if (text.length > 5) {
      console.log(`  [y=${r.y.toFixed(1)}] ${text}`);
    }
  }
}
