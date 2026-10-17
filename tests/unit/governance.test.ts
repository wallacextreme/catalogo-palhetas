import { describe, expect, it } from 'bun:test';
import {
  evaluateTechnicalStatus,
  evaluateFamilyTechnicalGovernance,
} from '@/domain/governance';
import type { Vehicle, VehicleFamilyResult } from '@/domain/types';

describe('Phase 5: Governança de Dados, Matriz de Confiança e Decisão Técnica no Balcão', () => {
  it('1. Multi-catálogo: DYNA 22", CINOY 22", VETOR 22" -> MULTI_CATALOG_CONFIRMED', () => {
    const result = evaluateTechnicalStatus({
      inchesA: 22,
      inchesB: 22,
      connectorA: 'Gancho',
      connectorB: 'Gancho',
      allBrandCodes: ['DYNA', 'CINOY', 'VETOR'],
    });

    expect(result.status).toBe('MULTI_CATALOG_CONFIRMED');
    expect(result.statusLabel).toBe('Confirmada em Múltiplos Catálogos');
    expect(result.catalogAgreement).toBe(true);
    expect(result.technicalConflict).toBe(false);
    expect(result.sourceCount).toBe(3);
    expect(result.uiDisplayMode).toBe('cross_reference');
    expect(result.explanation).toContain('confirmada em 3 catálogos');
  });

  it('2. Dimensão divergente: DYNA 24", VETOR 26" -> SOURCE_CONFLICT', () => {
    const result = evaluateTechnicalStatus({
      inchesA: 24,
      inchesB: 26,
      connectorA: 'TL2',
      connectorB: 'TL2',
      brandA: 'DYNA',
      brandB: 'VETOR',
    });

    expect(result.status).toBe('SOURCE_CONFLICT');
    expect(result.statusLabel).toBe('Divergência Documental');
    expect(result.catalogAgreement).toBe(false);
    expect(result.technicalConflict).toBe(true);
    expect(result.uiDisplayMode).toBe('warning');
    expect(result.explanation).toContain('Divergência dimensional entre catálogos');
    expect(result.divergenceDetails).toContain('24"');
    expect(result.divergenceDetails).toContain('26"');
  });

  it('3. Carroceria: Hilux padrão, Hilux cabine -> TECHNICAL_VARIANT', () => {
    const result = evaluateTechnicalStatus({
      bodyVariantA: 'Cabine',
      bodyVariantB: 'Padrão',
      allBrandCodes: ['DYNA'],
    });

    expect(result.status).toBe('TECHNICAL_VARIANT');
    expect(result.statusLabel).toBe('Variante Documentada');
    expect(result.technicalConflict).toBe(false);
    expect(result.uiDisplayMode).toBe('technical_variant');
    expect(result.explanation).toContain('Aplicações distintas por carroceria');
  });

  it('4. Conector: mesma medida, conector diferente -> CONNECTOR_VARIANT', () => {
    const result = evaluateTechnicalStatus({
      inchesA: 24,
      inchesB: 24,
      connectorA: 'Gancho',
      connectorB: 'Top Lock TL2',
      brandA: 'DYNA',
      brandB: 'CINOY',
    });

    expect(result.status).toBe('CONNECTOR_VARIANT');
    expect(result.statusLabel).toBe('Variante de Encaixe');
    expect(result.catalogAgreement).toBe(false);
    expect(result.technicalConflict).toBe(true);
    expect(result.uiDisplayMode).toBe('warning');
    expect(result.explanation).toContain('conectores diferentes documentados');
  });

  it('5. Fonte suspeita: ano corrompido 1015 -> SOURCE_REVIEW', () => {
    const vehicleSuspect: Vehicle = {
      id: 'veh_test_suspect',
      manufacturerId: 'mfr_test',
      brand: 'Mercedes-Benz',
      model: 'Classe C',
      category: 'passeio',
      yearStart: null,
      yearEnd: null,
      yearEndOpen: false,
      yearRaw: '1015/2017',
      sourceIds: ['src_vetor_2025'],
    };

    const result = evaluateTechnicalStatus({
      vehicleA: vehicleSuspect,
    });

    expect(result.status).toBe('SOURCE_REVIEW');
    expect(result.statusLabel).toBe('Revisão Necessária');
    expect(result.technicalConflict).toBe(true);
    expect(result.uiDisplayMode).toBe('review_required');
    expect(result.divergenceDetails).toContain('PDF oficial');
  });

  it('6. Avalia governança de família com divergência documental real (Tracker 2020+)', () => {
    const mockFamily: VehicleFamilyResult = {
      id: 'fam_chevrolet_tracker',
      type: 'vehicle_family',
      brand: 'Chevrolet',
      model: 'Tracker',
      fullName: 'Chevrolet Tracker',
      category: 'utilitario_leve',
      totalVariants: 2,
      documentedBrands: ['DYNA', 'VETOR'],
      sourceIds: ['src_1', 'src_2'],
      variants: [
        {
          id: 'var_tracker_1',
          label: '2020 em diante',
          yearStart: 2020,
          yearEnd: null,
          yearEndOpen: true,
          yearRaw: '2020 em diante',
          vehicle: {
            id: 'v1',
            manufacturerId: 'm1',
            brand: 'Chevrolet',
            model: 'Tracker',
            category: 'utilitario_leve',
            yearStart: 2020,
            yearEnd: null,
            yearEndOpen: true,
            yearRaw: '2020 em diante',
            sourceIds: ['src_1'],
          },
          sourceIds: ['src_1'],
          vehicleIds: ['v1'],
          documentedBrands: ['DYNA'],
          applications: [
            {
              id: 'app_1',
              position: 'motorista',
              positionLabel: 'Motorista',
              inches: 24,
              millimeters: 600,
              connectorRaw: 'TL2',
              fits: [
                {
                  product: {
                    id: 'p1',
                    code: 'DX24',
                    manufacturerId: 'm1',
                    inches: [24],
                    millimeters: [600],
                    armCompatibility: [],
                    sourceIds: ['src_1'],
                  },
                  manufacturerCode: 'DYNA',
                  relationType: 'catalog_documented',
                  sources: [],
                },
              ],
            },
          ],
        },
        {
          id: 'var_tracker_2',
          label: '2020 em diante',
          yearStart: 2020,
          yearEnd: null,
          yearEndOpen: true,
          yearRaw: '2020 em diante',
          vehicle: {
            id: 'v2',
            manufacturerId: 'm2',
            brand: 'Chevrolet',
            model: 'Tracker',
            category: 'utilitario_leve',
            yearStart: 2020,
            yearEnd: null,
            yearEndOpen: true,
            yearRaw: '2020 em diante',
            sourceIds: ['src_2'],
          },
          sourceIds: ['src_2'],
          vehicleIds: ['v2'],
          documentedBrands: ['VETOR'],
          applications: [
            {
              id: 'app_2',
              position: 'motorista',
              positionLabel: 'Motorista',
              inches: 26,
              millimeters: 650,
              connectorRaw: 'TL2',
              fits: [
                {
                  product: {
                    id: 'p2',
                    code: 'VT26',
                    manufacturerId: 'm2',
                    inches: [26],
                    millimeters: [650],
                    armCompatibility: [],
                    sourceIds: ['src_2'],
                  },
                  manufacturerCode: 'VETOR',
                  relationType: 'catalog_documented',
                  sources: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const gov = evaluateFamilyTechnicalGovernance(mockFamily);
    expect(gov.documentaryDivergencesCount).toBe(1);
    expect(gov.requiresSpecialAttention).toBe(true);
    expect(gov.divergenceDetails[0]?.warningMessage).toContain('DYNA: 24"');
    expect(gov.divergenceDetails[0]?.warningMessage).toContain('VETOR: 26"');
    expect(gov.badgeSummaryText).toContain('1 divergência documental');
  });

  it('7. Avalia governança de família com concordância multi-catálogo e sem divergência (Hilux 2005-2015)', () => {
    const mockFamily: VehicleFamilyResult = {
      id: 'fam_toyota_hilux',
      type: 'vehicle_family',
      brand: 'Toyota',
      model: 'Hilux',
      fullName: 'Toyota Hilux',
      category: 'utilitario_leve',
      totalVariants: 1,
      documentedBrands: ['DYNA', 'CINOY', 'VETOR'],
      sourceIds: ['src_1', 'src_2', 'src_3'],
      variants: [
        {
          id: 'var_hilux_1',
          label: '2005 → 2015',
          yearStart: 2005,
          yearEnd: 2015,
          yearEndOpen: false,
          yearRaw: '2005 a 2015',
          vehicle: {
            id: 'v1',
            manufacturerId: 'm1',
            brand: 'Toyota',
            model: 'Hilux',
            category: 'utilitario_leve',
            yearStart: 2005,
            yearEnd: 2015,
            yearEndOpen: false,
            yearRaw: '2005 a 2015',
            sourceIds: ['src_1', 'src_2', 'src_3'],
          },
          sourceIds: ['src_1', 'src_2', 'src_3'],
          vehicleIds: ['v1'],
          documentedBrands: ['DYNA', 'CINOY', 'VETOR'],
          applications: [
            {
              id: 'app_1',
              position: 'motorista',
              positionLabel: 'Motorista',
              inches: 21,
              millimeters: 525,
              connectorRaw: 'Gancho',
              fits: [
                {
                  product: { id: 'p1', code: 'DX21', manufacturerId: 'm1', inches: [21], millimeters: [525], armCompatibility: [], sourceIds: [] },
                  manufacturerCode: 'DYNA',
                  relationType: 'catalog_documented',
                  sources: [],
                },
                {
                  product: { id: 'p2', code: 'CN21', manufacturerId: 'm2', inches: [21], millimeters: [525], armCompatibility: [], sourceIds: [] },
                  manufacturerCode: 'CINOY',
                  relationType: 'catalog_documented',
                  sources: [],
                },
                {
                  product: { id: 'p3', code: 'VT21', manufacturerId: 'm3', inches: [21], millimeters: [525], armCompatibility: [], sourceIds: [] },
                  manufacturerCode: 'VETOR',
                  relationType: 'catalog_documented',
                  sources: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const gov = evaluateFamilyTechnicalGovernance(mockFamily);
    expect(gov.documentaryDivergencesCount).toBe(0);
    expect(gov.confirmedCatalogsCount).toBe(3);
    expect(gov.requiresSpecialAttention).toBe(false);
    expect(gov.badgeSummaryText).toContain('3 catálogos');
  });
});
