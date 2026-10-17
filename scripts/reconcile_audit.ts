import { auditDatasetConflicts } from '../src/domain/conflicts';
import type { CatalogDataset } from '../src/domain/types';

async function main() {
  const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
  const audit = auditDatasetConflicts(dataset);

  const p2Records = audit.records.filter(r => r.priority === 'P2');
  const errRecords = audit.records.filter(r => r.classification === 'possible_source_error');

  console.log('Count of priority P2:', p2Records.length);
  console.log('Count of possible_source_error:', errRecords.length);
  console.log('Are they exactly the same set?', p2Records.length === errRecords.length && p2Records.every(r => r.classification === 'possible_source_error'));

  console.log('\n--- 13 CASOS DETALHADOS ---');
  for (let i = 0; i < errRecords.length; i++) {
    const r = errRecords[i]!;
    console.log(`\n[Caso ${i + 1}] ID: ${r.id}`);
    console.log(`  Família: ${r.brand} ${r.family} | Posição: ${r.position}`);
    console.log(`  Veículo A: [${r.vehicleA.id}] "${r.vehicleA.model}" | Anos: "${r.vehicleA.years}" (${r.vehicleA.yearStart}..${r.vehicleA.yearEnd}) | Fontes: ${r.vehicleA.sourceIds.join(', ')}`);
    console.log(`  Veículo B: [${r.vehicleB.id}] "${r.vehicleB.model}" | Anos: "${r.vehicleB.years}" (${r.vehicleB.yearStart}..${r.vehicleB.yearEnd}) | Fontes: ${r.vehicleB.sourceIds.join(', ')}`);
    console.log(`  Aplicação A: ${r.appA.inches}" (${r.appA.connector || 'padrao'}) | Aplicação B: ${r.appB.inches}" (${r.appB.connector || 'padrao'})`);
    console.log(`  Motivo: ${r.description}`);
  }
}

main().catch(console.error);
