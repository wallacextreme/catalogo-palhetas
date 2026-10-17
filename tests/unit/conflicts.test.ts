import { describe, expect, it, beforeAll } from 'bun:test';
import type { CatalogDataset, Vehicle, VehicleApplication } from '@/domain/types';
import {
  classifyApplicationPair,
  auditDatasetConflicts,
  isSuspectedSourceError,
} from '@/domain/conflicts';

function createMockApp(data: {
  id: string;
  vehicleId: string;
  position: VehicleApplication['position'];
  inches?: number | null;
  millimeters?: number | null;
  connectorRaw?: string;
  sourceIds?: string[];
}): VehicleApplication {
  return {
    id: data.id,
    vehicleId: data.vehicleId,
    position: data.position,
    inches: data.inches ?? null,
    millimeters: data.millimeters ?? null,
    sourceInches: data.inches ?? null,
    sourceMillimeters: data.millimeters ?? null,
    calculatedMillimeters: null,
    sizeLabel: data.inches ? `${data.inches}"` : null,
    measureOrigin: 'application_table',
    connectorRaw: data.connectorRaw,
    sourceIds: data.sourceIds ?? [],
  };
}

describe('Phase 4: Conflict Classification & Decision Engine (Parte 25)', () => {
  let dataset: CatalogDataset;

  beforeAll(async () => {
    dataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
  });

  const baseVehicleA: Vehicle = {
    id: 'veh_test_a',
    manufacturerId: 'mfr_toyota',
    brand: 'Toyota',
    model: 'Hilux',
    category: 'utilitario_leve',
    yearStart: 2005,
    yearEnd: 2015,
    yearEndOpen: false,
    yearRaw: '2005 a 2015',
    sourceIds: ['src_dyna_2025'],
  };

  const baseVehicleB: Vehicle = {
    id: 'veh_test_b',
    manufacturerId: 'mfr_toyota',
    brand: 'Toyota',
    model: 'Hilux',
    category: 'utilitario_leve',
    yearStart: 2005,
    yearEnd: 2015,
    yearEndOpen: false,
    yearRaw: '2005 a 2015',
    sourceIds: ['src_cinoy_2024'],
  };

  it('Caso A: mesmo veículo, mesmo período, mesma posição, 24" e 24" -> same_application_multicatalog', () => {
    const appA = createMockApp({
      id: 'app_a',
      vehicleId: baseVehicleA.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Ganchinho',
      sourceIds: ['src_dyna_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: baseVehicleB.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Ganchinho',
      sourceIds: ['src_cinoy_2024'],
    });

    const result = classifyApplicationPair(appA, appB, baseVehicleA, baseVehicleB);
    expect(result.classification).toBe('same_application_multicatalog');
    expect(result.priority).toBe('P4');
  });

  it('Caso B (Multi-Fonte): 24" vs 26" entre fontes diferentes -> source_conflict (P0 para delta >= 2")', () => {
    const appA = createMockApp({
      id: 'app_a',
      vehicleId: baseVehicleA.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Gancho',
      sourceIds: ['src_dyna_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: baseVehicleB.id,
      position: 'motorista',
      inches: 26,
      millimeters: 650,
      connectorRaw: 'Gancho',
      sourceIds: ['src_vetor_2025'],
    });

    const result = classifyApplicationPair(appA, appB, baseVehicleA, baseVehicleB);
    expect(result.classification).toBe('source_conflict');
    expect(result.priority).toBe('P0');
  });

  it('Caso B (Mesma Fonte): 24" vs 26" na mesma fonte -> dimension_variant', () => {
    const vehSameSourceA: Vehicle = { ...baseVehicleA, sourceIds: ['src_vetor_2025'] };
    const vehSameSourceB: Vehicle = { ...baseVehicleB, sourceIds: ['src_vetor_2025'] };

    const appA = createMockApp({
      id: 'app_a',
      vehicleId: vehSameSourceA.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Gancho',
      sourceIds: ['src_vetor_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: vehSameSourceB.id,
      position: 'motorista',
      inches: 26,
      millimeters: 650,
      connectorRaw: 'Gancho',
      sourceIds: ['src_vetor_2025'],
    });

    const result = classifyApplicationPair(appA, appB, vehSameSourceA, vehSameSourceB);
    expect(result.classification).toBe('dimension_variant');
  });

  it('Caso C: mesma medida, conector diferente -> connector_variant', () => {
    const appA = createMockApp({
      id: 'app_a',
      vehicleId: baseVehicleA.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Gancho',
      sourceIds: ['src_dyna_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: baseVehicleB.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Top Lock TL2',
      sourceIds: ['src_cinoy_2024'],
    });

    const result = classifyApplicationPair(appA, appB, baseVehicleA, baseVehicleB);
    expect(result.classification).toBe('connector_variant');
    expect(result.priority).toBe('P1');
  });

  it('Caso D: medida diferente e conector diferente -> dimension_and_connector_variant (P0 crítico)', () => {
    const appA = createMockApp({
      id: 'app_a',
      vehicleId: baseVehicleA.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      connectorRaw: 'Gancho',
      sourceIds: ['src_dyna_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: baseVehicleB.id,
      position: 'motorista',
      inches: 26,
      millimeters: 650,
      connectorRaw: 'Top Lock TL2',
      sourceIds: ['src_vetor_2025'],
    });

    const result = classifyApplicationPair(appA, appB, baseVehicleA, baseVehicleB);
    expect(result.classification).toBe('dimension_and_connector_variant');
    expect(result.priority).toBe('P0');
  });

  it('Detecta variantes técnicas legítimas de carroceria documentada (Padrão vs Cabine)', () => {
    const vehCabine: Vehicle = {
      ...baseVehicleA,
      model: 'Hilux Cabine',
    };

    const appA = createMockApp({
      id: 'app_a',
      vehicleId: baseVehicleA.id,
      position: 'passageiro',
      inches: 22,
      millimeters: 550,
      connectorRaw: 'Gancho',
      sourceIds: ['src_dyna_2025'],
    });

    const appB = createMockApp({
      id: 'app_b',
      vehicleId: vehCabine.id,
      position: 'passageiro',
      inches: 16,
      millimeters: 400,
      connectorRaw: 'Gancho',
      sourceIds: ['src_dyna_2025'],
    });

    const result = classifyApplicationPair(appA, appB, baseVehicleA, vehCabine);
    expect(result.classification).toBe('technical_variant');
    expect(result.priority).toBe('P3');
  });

  it('Detecta possíveis erros materiais na impressão de origem (1015, 19911)', () => {
    const vehError: Vehicle = {
      ...baseVehicleA,
      yearRaw: '1015/...',
    };

    expect(isSuspectedSourceError(vehError)).toBe(true);

    const appA = createMockApp({
      id: 'app_a',
      vehicleId: vehError.id,
      position: 'motorista',
      inches: 24,
      millimeters: 600,
      sourceIds: ['src_vetor_2025'],
    });

    const result = classifyApplicationPair(appA, appA, vehError, baseVehicleB);
    expect(result.classification).toBe('possible_source_error');
    expect(result.priority).toBe('P2');
  });

  it('Executa auditoria formal no dataset completo com alta performance e reconciliação matemática (Fase 5)', () => {
    const t0 = performance.now();
    const audit = auditDatasetConflicts(dataset);
    const durationMs = performance.now() - t0;

    expect(durationMs).toBeLessThan(1000);

    // Métrica reconciliada da Fase 5: classifiedPairs + unclassifiedPairs = totalPairs
    expect(audit.totalPairs).toBe(7139);
    expect(audit.classifiedPairs).toBe(7139);
    expect(audit.unclassifiedPairs).toBe(0);
    expect(audit.classifiedPairs + audit.unclassifiedPairs).toBe(audit.totalPairs);

    // Pares em concordância multi-catálogo vs pares em registros de conflito
    expect(audit.multiCatalogPairs).toBe(2477);
    expect(audit.conflictRecordsCount).toBe(4662);
    expect(audit.records.length).toBe(audit.conflictRecordsCount);
    expect(audit.conflictRecordsCount + audit.multiCatalogPairs).toBe(audit.totalPairs);

    // Todas as classificações essenciais da Fase 5 estão mapeadas
    expect(audit.byClassification['same_application_multicatalog']).toBe(2477);
    expect(audit.byClassification['technical_variant']).toBe(926);
    expect(audit.byClassification['dimension_variant']).toBe(363);
    expect(audit.byClassification['connector_variant']).toBe(1466);
    expect(audit.byClassification['dimension_and_connector_variant']).toBe(1692);
    expect(audit.byClassification['source_conflict']).toBe(185);
    expect(audit.byClassification['duplicate_commercial_entry']).toBe(17);
    expect(audit.byClassification['possible_source_error']).toBe(13);
    expect(audit.byClassification['ambiguous']).toBe(0);

    // Prioridades P0 a P4 estão preenchidas e somam exatamente totalPairs
    expect(audit.byPriority['P0']).toBe(2091);
    expect(audit.byPriority['P1']).toBe(1615);
    expect(audit.byPriority['P2']).toBe(13);
    expect(audit.byPriority['P3']).toBe(943);
    expect(audit.byPriority['P4']).toBe(2477);
    const sumPrio =
      audit.byPriority['P0'] +
      audit.byPriority['P1'] +
      audit.byPriority['P2'] +
      audit.byPriority['P3'] +
      audit.byPriority['P4'];
    expect(sumPrio).toBe(audit.totalPairs);

    // Valida estrutura enriquecida dos registros de conflito (Fase 5)
    for (const rec of audit.records.slice(0, 50)) {
      expect(rec.recommendedAction).toBeDefined();
      expect([
        'KEEP_SEPARATE',
        'MERGE_AS_CROSS_REFERENCE',
        'DISPLAY_WARNING',
        'REVIEW_SOURCE',
        'REVIEW_HUMAN',
        'IGNORE_LEGITIMATE_DIFFERENCE',
      ]).toContain(rec.recommendedAction);
      expect(rec.dimensions).toBeDefined();
      expect(rec.connectors).toBeDefined();
      expect(rec.years).toBeDefined();
    }
  });
});
