import fs from 'fs';
import path from 'path';
import type { CatalogDataset } from '../src/domain/types';
import { extractModelMetadata } from '../src/domain/consolidation';

const dataset: CatalogDataset = JSON.parse(fs.readFileSync(path.resolve('data/validated/dataset.json'), 'utf-8'));

console.log('=== DETALHAMENTO DE ANOMALIAS ESPECÍFICAS ===\n');

// 1. Os 11 veículos com anos não parseados
console.log('--- 1. VEÍCULOS COM ANOS NÃO PARSEADOS ---');
const unparsedVehicles = dataset.vehicles.filter(v => v.yearStart === null && v.yearEnd === null && v.yearRaw && v.yearRaw !== '****');
for (const v of unparsedVehicles) {
  console.log(`- ID: ${v.id} | ${v.brand} ${v.model} | yearRaw: "${v.yearRaw}" | notes: "${v.notes || ''}"`);
}

// 2. As 45 aplicações sem produto
console.log('\n--- 2. APLICAÇÕES SEM PRODUTO VINCULADO ---');
const usedAppIds = new Set(dataset.fits.map(f => f.vehicleApplicationId));
const appsWithoutProduct = dataset.applications.filter(a => !usedAppIds.has(a.id));
console.log(`Total: ${appsWithoutProduct.length}`);
const vehicleMap = new Map(dataset.vehicles.map(v => [v.id, v]));
for (const a of appsWithoutProduct.slice(0, 10)) {
  const v = vehicleMap.get(a.vehicleId);
  console.log(`- App ID: ${a.id} | Veículo: ${v?.brand} ${v?.model} (${v?.yearRaw}) | Posição: ${a.position} | Medida: ${a.inches}" | Encaixe: ${a.connectorRaw}`);
}

// 3. Amostra de produtos órfãos
console.log('\n--- 3. PRODUTOS ÓRFÃOS (AMOSTRA DE 10) ---');
const usedProductIds = new Set(dataset.fits.map(f => f.brandProductId));
const orphanProducts = dataset.products.filter(p => !usedProductIds.has(p.id));
console.log(`Total órfãos: ${orphanProducts.length} de ${dataset.products.length}`);
const mfrMap = new Map(dataset.manufacturers.map(m => [m.id, m.code]));
for (const p of orphanProducts.slice(0, 10)) {
  console.log(`- Prod: [${mfrMap.get(p.manufacturerId)}] Código: "${p.code}" | Linha: "${p.family || ''}" | Medida: ${p.inches.join('/')}" | Conectores: "${p.armCompatibility.join(',')}"`);
}

// 4. Auditoria de Famílias Principais: GOL, ETIOS, ONIX, COROLLA, PALIO, UNO, HB20, CIVIC
console.log('\n--- 4. AUDITORIA DAS FAMÍLIAS PRINCIPAIS ---');
const targetFamilies = ['GOL', 'GOLF', 'ETIOS', 'ONIX', 'COROLLA', 'PALIO', 'UNO', 'HB20', 'CIVIC'];

for (const tf of targetFamilies) {
  const matchingVehicles = dataset.vehicles.filter(v => {
    const meta = extractModelMetadata(v.model);
    return meta.family.toUpperCase() === tf || v.model.toUpperCase().includes(tf);
  });

  const apps = matchingVehicles.flatMap(v => dataset.applications.filter(a => a.vehicleId === v.id));
  const distinctYears = Array.from(new Set(matchingVehicles.map(v => v.yearRaw))).join(', ');
  const positions = Array.from(new Set(apps.map(a => a.position))).join(', ');
  const inches = Array.from(new Set(apps.map(a => a.inches).filter(Boolean))).sort((a,b)=> (a as number)-(b as number)).map(i => `${i}"`).join(', ');

  console.log(`\nFamília: ${tf}`);
  console.log(`  Registros de veículos: ${matchingVehicles.length}`);
  console.log(`  Total de aplicações: ${apps.length}`);
  console.log(`  Posições documentadas: ${positions}`);
  console.log(`  Medidas encontradas: ${inches}`);
  console.log(`  Faixas de anos: ${distinctYears}`);
}
