import fs from 'fs';
import path from 'path';
import type { CatalogDataset, Vehicle } from '../src/domain/types';
import { extractModelMetadata } from '../src/domain/consolidation';
import { canonicalizeManufacturer } from '../src/domain/manufacturers';

const dataset: CatalogDataset = JSON.parse(fs.readFileSync(path.resolve('data/validated/dataset.json'), 'utf-8'));

console.log('=== DETECÇÃO DE LACUNAS SUSPEITAS DE ANOS ===\n');

const familyMap = new Map<string, Vehicle[]>();
for (const v of dataset.vehicles) {
  const brand = canonicalizeManufacturer(v.brand) || v.brand;
  const meta = extractModelMetadata(v.model);
  const key = `${brand}|${meta.family}`;
  if (!familyMap.has(key)) familyMap.set(key, []);
  familyMap.get(key)!.push(v);
}

interface GapRecord {
  familyKey: string;
  periodA: string;
  periodB: string;
  missingYears: number[];
  sources: string[];
}

const detectedGaps: GapRecord[] = [];

for (const [famKey, vList] of familyMap.entries()) {
  // Coleta todos os intervalos definidos
  const intervals: Array<{ start: number; end: number; raw: string; source: string }> = [];
  for (const v of vList) {
    if (v.yearStart !== null) {
      const end = v.yearEnd ?? (v.yearEndOpen ? 2026 : v.yearStart);
      intervals.push({ start: v.yearStart, end, raw: v.yearRaw, source: v.sourceIds.join(',') });
    }
  }

  if (intervals.length < 2) continue;

  intervals.sort((a, b) => a.start - b.start);

  for (let i = 0; i < intervals.length - 1; i++) {
    const cur = intervals[i]!;
    const next = intervals[i + 1]!;

    // Se o próximo começa mais de 1 ano após o término do atual (sem sobreposição)
    if (next.start > cur.end + 1 && (next.start - cur.end) <= 4) {
      const missingYears: number[] = [];
      for (let y = cur.end + 1; y < next.start; y++) missingYears.push(y);

      // Verifica se outro intervalo cobre esses anos
      const covered = missingYears.every(my => intervals.some(it => it.start <= my && it.end >= my));
      if (!covered) {
        detectedGaps.push({
          familyKey: famKey,
          periodA: `${cur.start} → ${cur.end} (${cur.raw})`,
          periodB: `${next.start} → ${next.end} (${next.raw})`,
          missingYears,
          sources: [cur.source, next.source]
        });
      }
    }
  }
}

// Remove duplicidades de gaps na mesma família
const uniqueGaps = new Map<string, GapRecord>();
for (const g of detectedGaps) {
  const key = `${g.familyKey}|${g.missingYears.join(',')}`;
  if (!uniqueGaps.has(key)) uniqueGaps.set(key, g);
}

console.log(`Total de lacunas suspeitas (1 a 4 anos sem cobertura dentro de ciclos da mesma família): ${uniqueGaps.size}`);
console.log('Amostra de 10 lacunas suspeitas:');
for (const g of Array.from(uniqueGaps.values()).slice(0, 10)) {
  console.log(`- Família: ${g.familyKey}`);
  console.log(`  Período A: ${g.periodA}`);
  console.log(`  Período B: ${g.periodB}`);
  console.log(`  Ano(s) sem cobertura: ${g.missingYears.join(', ')}`);
}
