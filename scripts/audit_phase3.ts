import fs from 'fs';
import path from 'path';
import type { CatalogDataset, Vehicle, VehicleApplication, BrandProduct, ProductFit, CatalogSource } from '../src/domain/types';
import { CatalogSearchEngine, extractYearFromQuery } from '../src/search/search-engine';
import { consolidateVehicleFamilies, extractModelMetadata } from '../src/domain/consolidation';
import { normalizeText } from '../src/domain/normalize';
import { canonicalizeManufacturer } from '../src/domain/manufacturers';
import { yearRangesOverlap } from '../src/domain/years';

console.log('=== INICIANDO AUDITORIA FASE 3 ===');

const datasetPath = path.resolve('data/validated/dataset.json');
const rawData = fs.readFileSync(datasetPath, 'utf-8');
const dataset: CatalogDataset = JSON.parse(rawData);

// 1. MÉTRICAS BÁSICAS
console.log('\n--- 1. MÉTRICAS BÁSICAS DO DATASET ---');
const totalVehicles = dataset.vehicles.length;
const totalApplications = dataset.applications.length;
const totalProducts = dataset.products.length;
const totalFits = dataset.fits.length;
const totalSources = dataset.sources.length;
const totalManufacturers = dataset.manufacturers.length;
const vehicleMfrs = dataset.manufacturers.filter(m => m.roles.includes('vehicle'));
const wiperMfrs = dataset.manufacturers.filter(m => m.roles.includes('wiper_blade'));

const distinctModelsRaw = new Set(dataset.vehicles.map(v => `${v.brand} ${v.model}`)).size;
const distinctFamiliesClean = new Set(dataset.vehicles.map(v => `${canonicalizeManufacturer(v.brand) || v.brand}|${extractModelMetadata(v.model).family}`)).size;

console.log(`Total de veículos: ${totalVehicles}`);
console.log(`Total de aplicações: ${totalApplications}`);
console.log(`Total de produtos: ${totalProducts}`);
console.log(`Total de relações (fits): ${totalFits}`);
console.log(`Total de fontes (sources): ${totalSources}`);
console.log(`Total de fabricantes: ${totalManufacturers} (${vehicleMfrs.length} montadoras, ${wiperMfrs.length} palheteiros)`);
console.log(`Modelos brutos distintos: ${distinctModelsRaw}`);
console.log(`Famílias limpas distintas: ${distinctFamiliesClean}`);

// MAPAS AUXILIARES
const appsByVehicleId = new Map<string, VehicleApplication[]>();
for (const app of dataset.applications) {
  if (!appsByVehicleId.has(app.vehicleId)) appsByVehicleId.set(app.vehicleId, []);
  appsByVehicleId.get(app.vehicleId)!.push(app);
}

const fitsByAppId = new Map<string, ProductFit[]>();
for (const fit of dataset.fits) {
  if (!fitsByAppId.has(fit.vehicleApplicationId)) fitsByAppId.set(fit.vehicleApplicationId, []);
  fitsByAppId.get(fit.vehicleApplicationId)!.push(fit);
}

const sourcesById = new Map<string, CatalogSource>();
for (const s of dataset.sources) sourcesById.set(s.id, s);

const productsById = new Map<string, BrandProduct>();
for (const p of dataset.products) productsById.set(p.id, p);

// 2. DUPLICIDADES EXATAS E QUASE-IGUAIS
console.log('\n--- 2. DETECÇÃO DE DUPLICIDADES ---');

interface DuplicateGroup {
  type: 'DUPLICIDADE CONFIRMADA' | 'POSSÍVEL DUPLICIDADE' | 'DIFERENÇA DOCUMENTAL';
  key: string;
  vehicles: Vehicle[];
  reason: string;
}

const dupMap = new Map<string, Vehicle[]>();
for (const v of dataset.vehicles) {
  const brand = canonicalizeManufacturer(v.brand) || v.brand;
  const modelNorm = normalizeText(v.model);
  const key = `${normalizeText(brand)}|${modelNorm}|${v.yearStart}|${v.yearEnd}|${v.yearEndOpen}|${v.category}`;
  if (!dupMap.has(key)) dupMap.set(key, []);
  dupMap.get(key)!.push(v);
}

const duplicateGroups: DuplicateGroup[] = [];

for (const [key, vList] of dupMap.entries()) {
  if (vList.length <= 1) continue;

  // Analisa as aplicações dos veículos do grupo
  const appSignatures = vList.map(v => {
    const apps = appsByVehicleId.get(v.id) || [];
    return apps.map(a => `${a.position}:${a.inches}:${a.connectorRaw || a.connectorId}`).sort().join(';');
  });

  const allAppsSame = appSignatures.every(sig => sig === appSignatures[0]);
  const allSourcesSame = vList.every(v => JSON.stringify(v.sourceIds) === JSON.stringify(vList[0]!.sourceIds));

  if (allAppsSame && allSourcesSame) {
    duplicateGroups.push({
      type: 'DUPLICIDADE CONFIRMADA',
      key,
      vehicles: vList,
      reason: 'Mesmo fabricante, modelo, ano, categoria, aplicações e fontes idênticas.'
    });
  } else if (allAppsSame) {
    duplicateGroups.push({
      type: 'DIFERENÇA DOCUMENTAL',
      key,
      vehicles: vList,
      reason: 'Mesmo veículo e aplicações, mas documentado por fontes/catálogos diferentes (DYNA, CINOY, VETOR).'
    });
  } else {
    duplicateGroups.push({
      type: 'POSSÍVEL DUPLICIDADE',
      key,
      vehicles: vList,
      reason: 'Mesmo veículo no mesmo ano, mas com diferenças em posições ou medidas informadas.'
    });
  }
}

console.log(`Grupos com mais de 1 registro idêntico de veículo: ${duplicateGroups.length}`);
const countConfirmedDup = duplicateGroups.filter(g => g.type === 'DUPLICIDADE CONFIRMADA').length;
const countDocDiff = duplicateGroups.filter(g => g.type === 'DIFERENÇA DOCUMENTAL').length;
const countPossibleDup = duplicateGroups.filter(g => g.type === 'POSSÍVEL DUPLICIDADE').length;
console.log(`- Duplicidade Confirmada (redundância total): ${countConfirmedDup}`);
console.log(`- Diferença Documental (mesma aplicação em catálogos distintos): ${countDocDiff}`);
console.log(`- Possível Duplicidade (mesmo ano mas aplicações variam): ${countPossibleDup}`);

// 3. CONFLITOS TÉCNICOS DE MEDIDAS E CONECTORES EM INTERVALOS SOBREPOSTOS
console.log('\n--- 3. DETECÇÃO DE CONFLITOS TÉCNICOS DE MEDIDA/CONECTOR ---');

interface TechnicalConflict {
  familyKey: string;
  brand: string;
  family: string;
  position: string;
  overlapRange: string;
  measures: Array<{ inches: number | null; mm: number | null; connector: string; source: string; vehicleModel: string; years: string }>;
  conflictType: 'MEDIDAS_DIFERENTES' | 'CONECTOR_DIFERENTE' | 'AMBOS';
}

const familyVehiclesMap = new Map<string, Vehicle[]>();
for (const v of dataset.vehicles) {
  const brand = canonicalizeManufacturer(v.brand) || v.brand;
  const meta = extractModelMetadata(v.model);
  const famKey = `${brand}|${meta.family}`;
  if (!familyVehiclesMap.has(famKey)) familyVehiclesMap.set(famKey, []);
  familyVehiclesMap.get(famKey)!.push(v);
}

const technicalConflicts: TechnicalConflict[] = [];

for (const [famKey, vList] of familyVehiclesMap.entries()) {
  const [brand, family] = famKey.split('|');

  for (let i = 0; i < vList.length; i++) {
    for (let j = i + 1; j < vList.length; j++) {
      const v1 = vList[i]!;
      const v2 = vList[j]!;

      // Verifica se há sobreposição real de anos
      if (!yearRangesOverlap(v1, v2)) continue;

      const apps1 = appsByVehicleId.get(v1.id) || [];
      const apps2 = appsByVehicleId.get(v2.id) || [];

      // Compara posições comuns
      for (const a1 of apps1) {
        for (const a2 of apps2) {
          if (a1.position !== a2.position) continue;

          const diffInches = a1.inches !== null && a2.inches !== null && Math.abs(a1.inches - a2.inches) >= 1;
          const diffConn = Boolean(a1.connectorRaw && a2.connectorRaw && normalizeText(a1.connectorRaw) !== normalizeText(a2.connectorRaw));

          if (diffInches || diffConn) {
            technicalConflicts.push({
              familyKey: famKey,
              brand: brand!,
              family: family!,
              position: a1.position,
              overlapRange: `${Math.max(v1.yearStart ?? 1900, v2.yearStart ?? 1900)} - ${Math.min(v1.yearEnd ?? 2030, v2.yearEnd ?? 2030)}`,
              measures: [
                { inches: a1.inches, mm: a1.millimeters, connector: a1.connectorRaw || 'Padrão', source: v1.sourceIds.join(','), vehicleModel: v1.model, years: v1.yearRaw },
                { inches: a2.inches, mm: a2.millimeters, connector: a2.connectorRaw || 'Padrão', source: v2.sourceIds.join(','), vehicleModel: v2.model, years: v2.yearRaw },
              ],
              conflictType: diffInches && diffConn ? 'AMBOS' : diffInches ? 'MEDIDAS_DIFERENTES' : 'CONECTOR_DIFERENTE'
            });
          }
        }
      }
    }
  }
}

console.log(`Total de pares com conflito técnico identificado: ${technicalConflicts.length}`);
const sampleConflicts = technicalConflicts.slice(0, 5);
console.log('Exemplos de conflito:', JSON.stringify(sampleConflicts, null, 2));

// 4. AUDITORIA ESPECIALIZADA: HILUX E SW4
console.log('\n--- 4. AUDITORIA ESPECIALIZADA: HILUX E SW4 ---');
const hiluxVehicles = dataset.vehicles.filter(v => normalizeText(v.brand) === 'toyota' && normalizeText(v.model).includes('hilux'));
console.log(`Registros da Toyota contendo 'hilux': ${hiluxVehicles.length}`);
const hiluxPure = hiluxVehicles.filter(v => !/\bsw4\b/i.test(v.model));
const hiluxSw4 = hiluxVehicles.filter(v => /\bsw4\b/i.test(v.model));

console.log(`- Hilux Picape / Cabine: ${hiluxPure.length} registros`);
for (const hp of hiluxPure) {
  const apps = appsByVehicleId.get(hp.id) || [];
  const appSummary = apps.map(a => `${a.position}: ${a.inches}"`).join(', ');
  console.log(`  * ID: ${hp.id} | Modelo: "${hp.model}" | Anos: ${hp.yearRaw} (${hp.yearStart}→${hp.yearEnd}) | Apps: ${appSummary}`);
}

console.log(`- Hilux SW4 (SUV): ${hiluxSw4.length} registros`);
for (const hs of hiluxSw4) {
  const apps = appsByVehicleId.get(hs.id) || [];
  const appSummary = apps.map(a => `${a.position}: ${a.inches}"`).join(', ');
  console.log(`  * ID: ${hs.id} | Modelo: "${hs.model}" | Anos: ${hs.yearRaw} (${hs.yearStart}→${hs.yearEnd}) | Apps: ${appSummary}`);
}

// 5. AUDITORIA DE PRODUTOS ÓRFÃOS E APLICAÇÕES SEM PRODUTO
console.log('\n--- 5. PRODUTOS ÓRFÃOS E APLICAÇÕES SEM PRODUTO ---');
const usedProductIds = new Set(dataset.fits.map(f => f.brandProductId));
const orphanProducts = dataset.products.filter(p => !usedProductIds.has(p.id));
console.log(`Produtos totais: ${dataset.products.length}`);
console.log(`Produtos com ao menos 1 aplicação (usados): ${usedProductIds.size}`);
console.log(`Produtos órfãos (sem nenhuma aplicação documentada): ${orphanProducts.length}`);

const usedAppIds = new Set(dataset.fits.map(f => f.vehicleApplicationId));
const appsWithoutProduct = dataset.applications.filter(a => !usedAppIds.has(a.id));
console.log(`Aplicações totais: ${dataset.applications.length}`);
console.log(`Aplicações com produto vinculado: ${usedAppIds.size}`);
console.log(`Aplicações sem produto correspondente: ${appsWithoutProduct.length}`);

// 6. AUDITORIA DE RASTREABILIDADE
console.log('\n--- 6. AUDITORIA DE RASTREABILIDADE ---');
const validSourceIds = new Set(dataset.sources.map(s => s.id));

let vehiclesWithoutSource = 0;
let vehiclesWithBrokenSource = 0;
for (const v of dataset.vehicles) {
  if (!v.sourceIds || v.sourceIds.length === 0) vehiclesWithoutSource++;
  else if (v.sourceIds.some(sid => !validSourceIds.has(sid))) vehiclesWithBrokenSource++;
}

let appsWithoutSource = 0;
let appsWithBrokenSource = 0;
for (const a of dataset.applications) {
  if (!a.sourceIds || a.sourceIds.length === 0) appsWithoutSource++;
  else if (a.sourceIds.some(sid => !validSourceIds.has(sid))) appsWithBrokenSource++;
}

let fitsWithoutSource = 0;
let fitsWithBrokenSource = 0;
for (const f of dataset.fits) {
  if (!f.sourceIds || f.sourceIds.length === 0) fitsWithoutSource++;
  else if (f.sourceIds.some(sid => !validSourceIds.has(sid))) fitsWithBrokenSource++;
}

console.log(`Veículos sem sourceId: ${vehiclesWithoutSource}`);
console.log(`Veículos com sourceId quebrado (não existe em sources): ${vehiclesWithBrokenSource}`);
console.log(`Aplicações sem sourceId: ${appsWithoutSource}`);
console.log(`Aplicações com sourceId quebrado: ${appsWithBrokenSource}`);
console.log(`Fits sem sourceId: ${fitsWithoutSource}`);
console.log(`Fits com sourceId quebrado: ${fitsWithBrokenSource}`);

// 7. AUDITORIA DE MEDIDAS SUSPEITAS
console.log('\n--- 7. AUDITORIA DE MEDIDAS SUSPEITAS ---');
let zeroOrNegativeInches = 0;
let inchesTooLarge = 0;
let zeroOrNegativeMm = 0;
let mmTooLarge = 0;
let inchMmDiscrepancy = 0;

for (const app of dataset.applications) {
  if (app.inches !== null) {
    if (app.inches <= 0) zeroOrNegativeInches++;
    if (app.inches > 36) inchesTooLarge++;
  }
  if (app.millimeters !== null) {
    if (app.millimeters <= 0) zeroOrNegativeMm++;
    if (app.millimeters > 950) mmTooLarge++;
  }
  if (app.inches !== null && app.millimeters !== null) {
    const expectedMm = app.inches * 25.4;
    if (Math.abs(expectedMm - app.millimeters) > 15) {
      inchMmDiscrepancy++;
    }
  }
}

console.log(`Polegadas <= 0: ${zeroOrNegativeInches}`);
console.log(`Polegadas > 36": ${inchesTooLarge}`);
console.log(`Milímetros <= 0: ${zeroOrNegativeMm}`);
console.log(`Milímetros > 950mm: ${mmTooLarge}`);
console.log(`Discrepância polegadas vs mm (>15mm): ${inchMmDiscrepancy}`);

// 8. AUDITORIA DE ANOS E NORMALIZAÇÃO
console.log('\n--- 8. AUDITORIA DE ANOS ---');
let invertedYearRange = 0;
let unparsedYears = 0;

for (const v of dataset.vehicles) {
  if (v.yearStart !== null && v.yearEnd !== null && v.yearStart > v.yearEnd) {
    invertedYearRange++;
  }
  if (v.yearStart === null && v.yearEnd === null && v.yearRaw && v.yearRaw !== '****') {
    unparsedYears++;
  }
}

console.log(`Faixas de ano invertidas (start > end): ${invertedYearRange}`);
console.log(`Anos não parseados com texto válido: ${unparsedYears}`);

// 9. AUDITORIA DE BUSCA E FRONTEIRA
console.log('\n--- 9. AUDITORIA DE BUSCA DE FRONTEIRA ---');
const engine = new CatalogSearchEngine(dataset);

const boundaryTestQueries = [
  { q: 'GOL', forbiddenSubstrings: ['golf', 'kadett'] },
  { q: 'GOLF', mustInclude: ['golf'], forbiddenExact: ['gol'] },
  { q: 'KA', forbiddenSubstrings: ['kadett'] },
  { q: 'ONIX', forbiddenSubstrings: ['onix plus'] },
  { q: 'HILUX', forbiddenSubstrings: ['sw4'] },
  { q: 'SW4', mustInclude: ['sw4'], forbiddenExact: ['hilux'] },
  { q: 'COROLLA', forbiddenSubstrings: ['corolla cross'] },
  { q: 'HB20', forbiddenSubstrings: ['hb20s'] },
];

for (const test of boundaryTestQueries) {
  const raw = engine.search(test.q);
  const consolidated = consolidateVehicleFamilies(raw);
  const models = consolidated.map(r => r.type === 'vehicle_family' ? r.family?.model.toLowerCase() : r.product?.code);
  const fullNames = consolidated.map(r => r.type === 'vehicle_family' ? r.family?.fullName.toLowerCase() : '');

  const leaks: string[] = [];
  if (test.forbiddenSubstrings) {
    for (const f of test.forbiddenSubstrings) {
      if (models.some(m => m?.includes(f)) || fullNames.some(fn => fn?.includes(f))) {
        leaks.push(`Contém proibido: "${f}"`);
      }
    }
  }
  if (test.forbiddenExact) {
    for (const fe of test.forbiddenExact) {
      if (models.some(m => m === fe)) {
        leaks.push(`Contém modelo exato proibido: "${fe}"`);
      }
    }
  }
  console.log(`Query: "${test.q}" -> ${consolidated.length} resultado(s) | Vazamentos: ${leaks.length > 0 ? leaks.join(', ') : 'Nenhum (100% isolado)'}`);
}

// 10. AUDITORIA DE BUSCA POR ANO E PRODUTO RESIDUAL
console.log('\n--- 10. AUDITORIA DE BUSCA POR ANO ---');
const yearQueries = ['HILUX 2015', 'HILUX 2016', 'HILUX 2020', 'GOL 2010', 'ETIOS 2018', 'ONIX 2021', '2015', '2016'];
for (const yq of yearQueries) {
  const raw = engine.search(yq);
  const y = extractYearFromQuery(yq);
  const consolidated = consolidateVehicleFamilies(raw, y);

  const productResults = consolidated.filter(r => r.type === 'product');
  const familyResults = consolidated.filter(r => r.type === 'vehicle_family');

  console.log(`Query: "${yq}" (ano detectado: ${y ?? 'nenhum'}) -> Famílias: ${familyResults.length}, Produtos: ${productResults.length}`);
}

console.log('\n=== AUDITORIA FASE 3 FINALIZADA COM SUCESSO ===');
