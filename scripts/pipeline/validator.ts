import type { CatalogDataset } from '@/domain/types';
import { POSITIONS } from '@/domain/types';
import { isPlausibleBladeInches } from '@/domain/measures';
import { detectHeavyLine } from '@/domain/vehicle-category';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  entity: string;
  id: string;
  message: string;
}

export interface ValidationReport {
  timestamp: string;
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  issues: ValidationIssue[];
  metrics: {
    manufacturers: number;
    catalogs: number;
    sources: number;
    connectors: number;
    vehicles: number;
    applications: number;
    products: number;
    fits: number;
    equivalences: number;
  };
}

export function validateDataset(dataset: CatalogDataset): ValidationReport {
  const issues: ValidationIssue[] = [];

  const sourceIds = new Set(dataset.sources.map((s) => s.id));
  const connectorIds = new Set(dataset.connectors.map((c) => c.id));
  const vehicleIds = new Set(dataset.vehicles.map((v) => v.id));
  const productIds = new Set(dataset.products.map((p) => p.id));
  const applicationIds = new Set(dataset.applications.map((a) => a.id));

  // 1. Validação de Veículos
  for (const v of dataset.vehicles) {
    // Checagem de Linha Pesada (Vazamento)
    const heavy = detectHeavyLine(v.brand, v.model, v.variant, v.notes);
    if (heavy.heavy) {
      issues.push({
        severity: 'error',
        entity: 'Vehicle',
        id: v.id,
        message: `Veículo contém termo de linha pesada proibido: "${heavy.term}" (${v.brand} ${v.model})`,
      });
    }

    // SourceIds válidos
    for (const sId of v.sourceIds) {
      if (!sourceIds.has(sId)) {
        issues.push({
          severity: 'error',
          entity: 'Vehicle',
          id: v.id,
          message: `Referência de fonte inexistente: "${sId}"`,
        });
      }
    }

    // Anos
    if (v.yearStart !== null && v.yearEnd !== null && v.yearEnd < v.yearStart) {
      issues.push({
        severity: 'error',
        entity: 'Vehicle',
        id: v.id,
        message: `Ano final menor que inicial: ${v.yearStart} > ${v.yearEnd}`,
      });
    }
  }

  // 2. Validação de Produtos
  for (const p of dataset.products) {
    if (!p.code || p.code.trim().length === 0) {
      issues.push({
        severity: 'error',
        entity: 'BrandProduct',
        id: p.id,
        message: 'Produto com código vazio',
      });
    }

    for (const sId of p.sourceIds) {
      if (!sourceIds.has(sId)) {
        issues.push({
          severity: 'error',
          entity: 'BrandProduct',
          id: p.id,
          message: `Referência de fonte inexistente: "${sId}"`,
        });
      }
    }

    for (const inch of p.inches) {
      if (!isPlausibleBladeInches(inch)) {
        issues.push({
          severity: 'warning',
          entity: 'BrandProduct',
          id: p.id,
          message: `Medida em polegadas fora da faixa usual: ${inch}" (${p.code})`,
        });
      }
    }
  }

  // 3. Validação de Aplicações
  const referencedVehicles = new Set<string>();
  for (const a of dataset.applications) {
    referencedVehicles.add(a.vehicleId);

    if (!vehicleIds.has(a.vehicleId)) {
      issues.push({
        severity: 'error',
        entity: 'VehicleApplication',
        id: a.id,
        message: `Aplicação com veículo inexistente: "${a.vehicleId}"`,
      });
    }

    if (!POSITIONS.includes(a.position)) {
      issues.push({
        severity: 'error',
        entity: 'VehicleApplication',
        id: a.id,
        message: `Posição de aplicação inválida: "${a.position}"`,
      });
    }

    if (a.connectorId && !connectorIds.has(a.connectorId)) {
      issues.push({
        severity: 'warning',
        entity: 'VehicleApplication',
        id: a.id,
        message: `Conector referenciado não encontrado no catálogo de conectores: "${a.connectorId}"`,
      });
    }

    for (const sId of a.sourceIds) {
      if (!sourceIds.has(sId)) {
        issues.push({
          severity: 'error',
          entity: 'VehicleApplication',
          id: a.id,
          message: `Aplicação com fonte inexistente: "${sId}"`,
        });
      }
    }
  }

  // 4. Validação de Fits
  const referencedProducts = new Set<string>();
  for (const f of dataset.fits) {
    referencedProducts.add(f.brandProductId);

    if (!applicationIds.has(f.vehicleApplicationId)) {
      issues.push({
        severity: 'error',
        entity: 'ProductFit',
        id: f.id,
        message: `Fit referenciando aplicação inexistente: "${f.vehicleApplicationId}"`,
      });
    }

    if (!productIds.has(f.brandProductId)) {
      issues.push({
        severity: 'error',
        entity: 'ProductFit',
        id: f.id,
        message: `Fit referenciando produto inexistente: "${f.brandProductId}"`,
      });
    }

    if (!f.sourceIds || f.sourceIds.length === 0) {
      issues.push({
        severity: 'error',
        entity: 'ProductFit',
        id: f.id,
        message: 'Fit sem sourceIds (proibido pela regra de rastreabilidade)',
      });
    }
  }

  // 5. Órfãos
  for (const v of dataset.vehicles) {
    if (!referencedVehicles.has(v.id)) {
      issues.push({
        severity: 'warning',
        entity: 'Vehicle',
        id: v.id,
        message: `Veículo sem aplicações cadastradas: ${v.brand} ${v.model}`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    timestamp: new Date().toISOString(),
    isValid: errors.length === 0,
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    issues,
    metrics: {
      manufacturers: dataset.manufacturers.length,
      catalogs: dataset.catalogs.length,
      sources: dataset.sources.length,
      connectors: dataset.connectors.length,
      vehicles: dataset.vehicles.length,
      applications: dataset.applications.length,
      products: dataset.products.length,
      fits: dataset.fits.length,
      equivalences: dataset.equivalences.length,
    },
  };
}
