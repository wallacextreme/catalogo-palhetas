import fs from 'fs';
import path from 'path';
import type { CatalogDataset } from '../src/domain/types';
import { normalizeText } from '../src/domain/normalize';
import { canonicalizeManufacturer } from '../src/domain/manufacturers';

const dataset: CatalogDataset = JSON.parse(fs.readFileSync(path.resolve('data/validated/dataset.json'), 'utf-8'));

console.log('=== ANÁLISE DOS 480 GRUPOS DE MULTI-CATÁLOGO ===\n');

const sourcesMap = new Map(dataset.sources.map(s => [s.id, s]));

const dupMap = new Map<string, any[]>();
for (const v of dataset.vehicles) {
  const brand = canonicalizeManufacturer(v.brand) || v.brand;
  const modelNorm = normalizeText(v.model);
  const key = `${normalizeText(brand)}|${modelNorm}|${v.yearStart}|${v.yearEnd}|${v.category}`;
  if (!dupMap.has(key)) dupMap.set(key, []);
  dupMap.get(key)!.push(v);
}

const multiGroups = Array.from(dupMap.entries()).filter(([_, vList]) => vList.length > 1);

console.log(`Grupos multi-registro: ${multiGroups.length}`);

// Analisa as origens dos catálogos para cada veículo nos grupos
let multiCatalogGroups = 0;
let sameCatalogGroups = 0;

for (const [_key, vList] of multiGroups) {
  const catalogNames = new Set(vList.flatMap(v => v.sourceIds.map((sid: string) => sourcesMap.get(sid)?.catalogName || 'Desconhecido')));
  if (catalogNames.size > 1) {
    multiCatalogGroups++;
  } else {
    sameCatalogGroups++;
  }
}

console.log(`- Grupos provenientes de catálogos DIFERENTES (ex: DYNA + CINOY + VETOR documentando o mesmo carro): ${multiCatalogGroups}`);
console.log(`- Grupos provenientes do MESMO catálogo (linhas duplicadas no mesmo PDF): ${sameCatalogGroups}`);

// Mostra 5 exemplos de sameCatalogGroups se houver
if (sameCatalogGroups > 0) {
  console.log('\nExemplos de mesmo catálogo:');
  for (const [key, vList] of multiGroups) {
    const catalogNames = new Set(vList.flatMap(v => v.sourceIds.map((sid: string) => sourcesMap.get(sid)?.catalogName || 'Desconhecido')));
    if (catalogNames.size === 1) {
      console.log(`Key: ${key}`);
      for (const v of vList) {
        console.log(`  vID: ${v.id} | model: "${v.model}" | yearRaw: "${v.yearRaw}" | sources: ${v.sourceIds.join(',')}`);
      }
    }
  }
}
