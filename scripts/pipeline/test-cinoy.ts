import rawCinoy from '../../data/raw/cinoy-2023.raw.json';

console.log('Total páginas Cinoy no raw:', rawCinoy.pages.length);

for (const pageNum of [66, 67, 100, 142, 162, 178, 200, 214, 220, 226]) {
  const p = rawCinoy.pages.find((page) => page.page === pageNum);
  if (!p) {
    console.log(`Página ${pageNum} não encontrada`);
    continue;
  }
  console.log(`\n=== Cinoy Página ${pageNum} (${p.spans.length} spans) ===`);
  const lines: string[] = [];
  for (const s of p.spans.slice(0, 30)) {
    lines.push(`[sz${s.sz} y=${s.y0.toFixed(0)} x=${s.x0.toFixed(0)}] ${s.t.trim()}`);
  }
  console.log(lines.join(' | '));
}
