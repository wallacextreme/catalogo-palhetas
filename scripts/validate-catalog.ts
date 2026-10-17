import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogDataset } from '../src/domain/types';
import { validateDataset } from './pipeline/validator';

function checkDuplicatePrimaryIds<T extends { id: string }>(items: T[], entityName: string): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const item of items) {
    if (!item.id || item.id.trim() === '') {
      errors.push(`[${entityName}] Registro com ID vazio detectado.`);
      continue;
    }
    if (seen.has(item.id)) {
      errors.push(`[${entityName}] ID primário duplicado detectado: "${item.id}"`);
    }
    seen.add(item.id);
  }
  return errors;
}

function main() {
  const rootDir = process.cwd();
  const validatedPath = resolve(rootDir, 'data/validated/dataset.json');
  const publicPath = resolve(rootDir, 'public/data/dataset.json');

  console.log('🔍 [VALIDATE:DATA] Iniciando auditoria de integridade do catálogo...');

  if (!existsSync(validatedPath)) {
    console.error(`✖ Arquivo não encontrado: ${validatedPath}`);
    process.exit(1);
  }
  if (!existsSync(publicPath)) {
    console.error(`✖ Arquivo não encontrado: ${publicPath}`);
    process.exit(1);
  }

  const dataset = JSON.parse(readFileSync(validatedPath, 'utf-8')) as CatalogDataset;
  const report = validateDataset(dataset);

  // Checagens de unicidade estrita de chaves primárias de entidades-mestre
  const primaryErrors = [
    ...checkDuplicatePrimaryIds(dataset.manufacturers, 'Manufacturer'),
    ...checkDuplicatePrimaryIds(dataset.catalogs, 'Catalog'),
    ...checkDuplicatePrimaryIds(dataset.sources, 'CatalogSource'),
    ...checkDuplicatePrimaryIds(dataset.connectors, 'Connector'),
    ...checkDuplicatePrimaryIds(dataset.vehicles, 'Vehicle'),
    ...checkDuplicatePrimaryIds(dataset.products, 'BrandProduct'),
  ];

  // Checagem de paridade entre data/validated/dataset.json e public/data/dataset.json
  const publicDataset = JSON.parse(readFileSync(publicPath, 'utf-8')) as CatalogDataset;
  if (
    publicDataset.vehicles.length !== dataset.vehicles.length ||
    publicDataset.applications.length !== dataset.applications.length ||
    publicDataset.products.length !== dataset.products.length ||
    publicDataset.fits.length !== dataset.fits.length
  ) {
    primaryErrors.push(
      'Divergência de contagem entre data/validated/dataset.json e public/data/dataset.json.',
    );
  }

  console.log('📊 Métricas da Base Validada:');
  console.log(`   • Fabricantes: ${report.metrics.manufacturers}`);
  console.log(`   • Catálogos:   ${report.metrics.catalogs}`);
  console.log(`   • Fontes PDF:  ${report.metrics.sources}`);
  console.log(`   • Conectores:  ${report.metrics.connectors}`);
  console.log(`   • Veículos:    ${report.metrics.vehicles}`);
  console.log(`   • Aplicações:  ${report.metrics.applications}`);
  console.log(`   • Produtos:    ${report.metrics.products}`);
  console.log(`   • Vínculos:    ${report.metrics.fits}`);

  const totalCriticalErrors = report.totalErrors + primaryErrors.length;
  if (totalCriticalErrors > 0) {
    console.error(`\n✖ FALHA NA VALIDAÇÃO: ${totalCriticalErrors} erro(s) crítico(s) encontrado(s):`);
    for (const err of primaryErrors) {
      console.error(`  - ${err}`);
    }
    for (const issue of report.issues.filter((i) => i.severity === 'error')) {
      console.error(`  - [${issue.entity} ${issue.id}] ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    `\n✔ [VALIDATE:DATA] 100% APROVADO! Zero erros de schema, zero IDs primários duplicados, zero órfãos relacionais (${report.totalWarnings} avisos informativos).`,
  );
}

main();
