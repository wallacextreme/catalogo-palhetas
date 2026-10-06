import fs from 'node:fs';
import path from 'node:path';
import type { CatalogDataset, Manufacturer, ProductFit } from '@/domain/types';
import { parseDynaCatalog } from './parsers/dyna-parser';
import { parseCinoyCatalog } from './parsers/cinoy-parser';
import { parseVetorCatalog } from './parsers/vetor-parser';
import { validateDataset } from './validator';
import { stableId } from '@/domain/ids';
import { normalizeText } from '@/domain/normalize';
import { yearRangesOverlap } from '@/domain/years';

console.log('=== INICIANDO PIPELINE DE PROCESSAMENTO DOS CATÁLOGOS ===\n');

const rawDir = path.resolve('data/raw');
const normalizedDir = path.resolve('data/normalized');
const validatedDir = path.resolve('data/validated');
const publicDataDir = path.resolve('public/data');

fs.mkdirSync(normalizedDir, { recursive: true });
fs.mkdirSync(validatedDir, { recursive: true });
fs.mkdirSync(publicDataDir, { recursive: true });

// 1. Carrega dados brutos
const dynaRaw = JSON.parse(fs.readFileSync(path.join(rawDir, 'dyna-2025.raw.json'), 'utf-8'));
const cinoyRaw = JSON.parse(fs.readFileSync(path.join(rawDir, 'cinoy-2023.raw.json'), 'utf-8'));
const vetorRaw = JSON.parse(fs.readFileSync(path.join(rawDir, 'vetor-2025.raw.json'), 'utf-8'));

console.log('1. Executando Parser DYNA 2025...');
const dynaResult = parseDynaCatalog(dynaRaw);
fs.writeFileSync(path.join(normalizedDir, 'dyna.json'), JSON.stringify(dynaResult, null, 2));
console.log(`   - Veículos: ${dynaResult.vehicles.length}, Aplicações: ${dynaResult.applications.length}, Produtos: ${dynaResult.products.length}`);
console.log(`   - Excluídos (Linha Pesada): ${dynaResult.excludedItems.length}`);

console.log('2. Executando Parser CINOY 2023...');
const cinoyResult = parseCinoyCatalog(cinoyRaw);
fs.writeFileSync(path.join(normalizedDir, 'cinoy.json'), JSON.stringify(cinoyResult, null, 2));
console.log(`   - Veículos: ${cinoyResult.vehicles.length}, Aplicações: ${cinoyResult.applications.length}, Produtos: ${cinoyResult.products.length}`);
console.log(`   - Excluídos (Linha Pesada/Caminhões): ${cinoyResult.excludedItems.length}`);

console.log('3. Executando Parser VETOR 2025...');
const vetorResult = parseVetorCatalog(vetorRaw);
fs.writeFileSync(path.join(normalizedDir, 'vetor.json'), JSON.stringify(vetorResult, null, 2));
console.log(`   - Veículos: ${vetorResult.vehicles.length}, Aplicações: ${vetorResult.applications.length}, Produtos: ${vetorResult.products.length}`);
console.log(`   - Excluídos (Linha Pesada/Bombas): ${vetorResult.excludedItems.length}`);

// 4. Unificação de Fabricantes (Montadoras de veículos + Fabricantes de palhetas)
const mfrMap = new Map<string, Manufacturer>();
function addMfr(m: Manufacturer) {
  const existing = mfrMap.get(m.id);
  if (!existing) {
    mfrMap.set(m.id, { ...m });
  } else {
    for (const r of m.roles) {
      if (!existing.roles.includes(r)) existing.roles.push(r);
    }
  }
}

addMfr(dynaResult.manufacturer);
addMfr(cinoyResult.manufacturer);
addMfr(vetorResult.manufacturer);

import { canonicalizeManufacturer } from '@/domain/manufacturers';

// Coleta e padroniza montadoras legítimas de veículos
const allVehicles = [...dynaResult.vehicles, ...cinoyResult.vehicles, ...vetorResult.vehicles];
for (const v of allVehicles) {
  const canon = canonicalizeManufacturer(v.brand);
  if (canon) {
    v.brand = canon;
    v.manufacturerId = stableId('mfr', normalizeText(canon));
  }
  if (v.brand && !mfrMap.has(v.manufacturerId)) {
    mfrMap.set(v.manufacturerId, {
      id: v.manufacturerId,
      code: normalizeText(v.brand).toUpperCase(),
      name: v.brand,
      active: true,
      roles: ['vehicle'],
    });
  }
}

// 5. Cruzamento Inteligente: Resolução de Cross-Reference Multi-marca (Fase 8)
// Regra suprema: mesma polegada + mesma conexão NUNCA conclui equivalência oficial.
// Somente gera 'application_match' quando o mesmo veículo (marca + modelo compatível)
// e faixa de anos sobreposta possui aplicação em outro fabricante.
console.log('\n4. Gerando Índices de Cross-Reference Multi-marca (Regra: aplicação coincidente ≠ equivalência)...');
const allApplications = [...dynaResult.applications, ...cinoyResult.applications, ...vetorResult.applications];
const allProducts = [...dynaResult.products, ...cinoyResult.products, ...vetorResult.products];
const allFits: ProductFit[] = [...dynaResult.fits, ...cinoyResult.fits, ...vetorResult.fits];

const vehicleById = new Map(allVehicles.map((v) => [v.id, v]));
const productById = new Map(allProducts.map((p) => [p.id, p]));

// Agrupa veículos por chave canônica: normalized(brand) + normalized(model)
const vehiclesByModelKey = new Map<string, typeof allVehicles>();
for (const v of allVehicles) {
  const key = `${normalizeText(v.brand)}|${normalizeText(v.model)}`;
  if (!vehiclesByModelKey.has(key)) vehiclesByModelKey.set(key, []);
  vehiclesByModelKey.get(key)!.push(v);
}

let applicationMatchCount = 0;

for (const app of allApplications) {
  const veh = vehicleById.get(app.vehicleId);
  if (!veh) continue;

  const key = `${normalizeText(veh.brand)}|${normalizeText(veh.model)}`;
  const similarVehicles = vehiclesByModelKey.get(key) ?? [];

  for (const otherVeh of similarVehicles) {
    if (otherVeh.id === veh.id) continue;

    // Checa sobreposição de ano
    const overlap = yearRangesOverlap(veh, otherVeh);
    if (!overlap) continue;

    // Encontra aplicações no outro veículo com mesma posição
    const otherApps = allApplications.filter(
      (a) => a.vehicleId === otherVeh.id && a.position === app.position,
    );

    for (const oApp of otherApps) {
      // Localiza produtos do outro app
      const otherFits = allFits.filter((f) => f.vehicleApplicationId === oApp.id);
      for (const oFit of otherFits) {
        const oProd = productById.get(oFit.brandProductId);
        if (!oProd) continue;

        // Se o produto for de fabricante diferente, gera ProductFit do tipo 'application_match'
        const existingFit = allFits.find(
          (f) => f.vehicleApplicationId === app.id && f.brandProductId === oProd.id,
        );

        if (!existingFit) {
          const fitId = stableId('fit_cross', app.id, oProd.id);
          allFits.push({
            id: fitId,
            vehicleApplicationId: app.id,
            brandProductId: oProd.id,
            relationType: 'application_match',
            sourceIds: [...app.sourceIds, ...oApp.sourceIds],
            notes: `Aplicação coincidente via ${otherVeh.brand} ${otherVeh.model} (${otherVeh.yearRaw})`,
          });
          applicationMatchCount++;
        }
      }
    }
  }
}

console.log(`   - Cross-references gerados por aplicação coincidente: ${applicationMatchCount}`);

// 6. Dataset Oficial
const officialDataset: CatalogDataset = {
  schemaVersion: 1,
  datasetVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  manufacturers: Array.from(mfrMap.values()),
  catalogs: [dynaResult.catalog, cinoyResult.catalog, vetorResult.catalog],
  sources: [...dynaResult.sources, ...cinoyResult.sources, ...vetorResult.sources],
  connectors: [...dynaResult.connectors, ...cinoyResult.connectors, ...vetorResult.connectors],
  connectorEquivalences: [],
  vehicles: allVehicles,
  applications: allApplications,
  products: allProducts,
  fits: allFits,
  equivalences: [],
  imports: [dynaResult.importRecord, cinoyResult.importRecord, vetorResult.importRecord],
};

console.log('\n5. Executando Validação Estrita do Dataset Oficial...');
const validation = validateDataset(officialDataset);
fs.writeFileSync(path.join(validatedDir, 'validation-report.json'), JSON.stringify(validation, null, 2));

console.log(`   - Status da Validação: ${validation.isValid ? 'APROVADO' : 'FALHOU'}`);
console.log(`   - Erros: ${validation.totalErrors}, Avisos: ${validation.totalWarnings}`);
if (validation.totalErrors > 0) {
  console.error('\nERROS ENCONTRADOS:');
  for (const err of validation.issues.filter((i) => i.severity === 'error').slice(0, 10)) {
    console.error(`  - [${err.entity}] ${err.message}`);
  }
}

// 7. Salva Dataset Final
fs.writeFileSync(path.join(validatedDir, 'dataset.json'), JSON.stringify(officialDataset, null, 2));
fs.writeFileSync(path.join(publicDataDir, 'dataset.json'), JSON.stringify(officialDataset));

console.log('\n=== PIPELINE CONCLUÍDO COM SUCESSO! ===');
console.log(`Dataset oficial salvo em:`);
console.log(`  - ${path.join(validatedDir, 'dataset.json')}`);
console.log(`  - ${path.join(publicDataDir, 'dataset.json')}`);
console.log(`Resumo:`);
console.log(`  - Montadoras/Fabricantes: ${officialDataset.manufacturers.length}`);
console.log(`  - Catálogos: ${officialDataset.catalogs.length}`);
console.log(`  - Páginas/Fontes Rastreáveis: ${officialDataset.sources.length}`);
console.log(`  - Conectores Catalogados: ${officialDataset.connectors.length}`);
console.log(`  - Veículos Únicos: ${officialDataset.vehicles.length}`);
console.log(`  - Aplicações Técnicas: ${officialDataset.applications.length}`);
console.log(`  - Produtos Oficiais: ${officialDataset.products.length}`);
console.log(`  - Fits de Compatibilidade: ${officialDataset.fits.length}`);
