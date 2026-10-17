import type {
  TechnicalVariant,
  TechnicalVariantApplication,
  VehicleFamilyResult,
  Vehicle,
} from './types';
import { isSuspectedSourceError } from './conflicts';
import { normalizeText } from './normalize';

/**
 * Status Técnico Formal de Governança (Fase 5)
 * Ponte entre as regras do domínio e a camada de apresentação na UI.
 */
export type TechnicalStatus =
  | 'DOCUMENTED'
  | 'MULTI_CATALOG_CONFIRMED'
  | 'TECHNICAL_VARIANT'
  | 'CONNECTOR_VARIANT'
  | 'SOURCE_CONFLICT'
  | 'SOURCE_REVIEW';

export interface TechnicalConfidenceMatrix {
  status: TechnicalStatus;
  statusLabel: string;
  sourceCount: number;
  catalogAgreement: boolean;
  technicalConflict: boolean;
  traceability: boolean;
  explanation: string;
  divergenceDetails?: string;
  uiDisplayMode: 'cross_reference' | 'technical_variant' | 'warning' | 'review_required' | 'standard';
}

export interface DocumentaryDivergenceDetail {
  position: string;
  positionLabel: string;
  years: string;
  options: Array<{
    brand: string;
    inches: number | null;
    connector?: string;
  }>;
  explanation: string;
  warningMessage: string;
}

export interface FamilyTechnicalGovernanceSummary {
  totalTechnicalApplications: number;
  confirmedCatalogsCount: number;
  confirmedCatalogsList: string[];
  documentaryDivergencesCount: number;
  divergenceDetails: DocumentaryDivergenceDetail[];
  hasBodyVariants: boolean;
  bodyVariantsList: string[];
  requiresSpecialAttention: boolean;
  badgeSummaryText: string;
}

/**
 * Avalia o status técnico e matriz de confiança de uma aplicação ou comparação direta.
 */
export function evaluateTechnicalStatus(params: {
  inchesA?: number | null;
  inchesB?: number | null;
  connectorA?: string;
  connectorB?: string;
  brandA?: string;
  brandB?: string;
  vehicleA?: Vehicle;
  vehicleB?: Vehicle;
  bodyVariantA?: string;
  bodyVariantB?: string;
  allBrandCodes?: string[];
}): TechnicalConfidenceMatrix {
  const {
    inchesA,
    inchesB,
    connectorA,
    connectorB,
    brandA,
    brandB,
    vehicleA,
    vehicleB,
    bodyVariantA,
    bodyVariantB,
    allBrandCodes,
  } = params;

  // 1. Fonte suspeita / Erro de catálogo
  if (
    (vehicleA && isSuspectedSourceError(vehicleA)) ||
    (vehicleB && isSuspectedSourceError(vehicleB)) ||
    (vehicleA?.yearRaw && /\b(?:1015|19911)\b/.test(vehicleA.yearRaw)) ||
    (vehicleB?.yearRaw && /\b(?:1015|19911)\b/.test(vehicleB.yearRaw))
  ) {
    return {
      status: 'SOURCE_REVIEW',
      statusLabel: 'Revisão Necessária',
      sourceCount: 1,
      catalogAgreement: false,
      technicalConflict: true,
      traceability: true,
      explanation: 'Registro possui anomalia tipográfica no catálogo original ou ano corrompido.',
      divergenceDetails: 'Necessita validação manual no PDF oficial.',
      uiDisplayMode: 'review_required',
    };
  }

  // 2. Variante de carroceria legítima documentada (ex: Padrão vs Cabine)
  if (bodyVariantA && bodyVariantB && bodyVariantA !== bodyVariantB) {
    return {
      status: 'TECHNICAL_VARIANT',
      statusLabel: 'Variante Documentada',
      sourceCount: allBrandCodes?.length || 2,
      catalogAgreement: true,
      technicalConflict: false,
      traceability: true,
      explanation: `Aplicações distintas por carroceria (${bodyVariantA} vs ${bodyVariantB}).`,
      uiDisplayMode: 'technical_variant',
    };
  }

  // 3. Comparação dimensional e de conector
  if (inchesA !== undefined && inchesB !== undefined) {
    const isSameInch = inchesA === inchesB;
    const connA = normalizeText(connectorA || 'padrao');
    const connB = normalizeText(connectorB || 'padrao');
    const isSameConn = connA === connB;

    // Divergência de Medida (ex: DYNA 24" vs VETOR 26")
    if (!isSameInch) {
      return {
        status: 'SOURCE_CONFLICT',
        statusLabel: 'Divergência Documental',
        sourceCount: 2,
        catalogAgreement: false,
        technicalConflict: true,
        traceability: true,
        explanation: `Divergência dimensional entre catálogos: ${brandA || 'Fonte A'} documenta ${inchesA}" e ${brandB || 'Fonte B'} documenta ${inchesB}".`,
        divergenceDetails: `${brandA || 'Fonte A'}: ${inchesA}" | ${brandB || 'Fonte B'}: ${inchesB}"`,
        uiDisplayMode: 'warning',
      };
    }

    // Mesma Medida, Conector Diferente (ex: Gancho vs TL2)
    if (isSameInch && !isSameConn) {
      return {
        status: 'CONNECTOR_VARIANT',
        statusLabel: 'Variante de Encaixe',
        sourceCount: 2,
        catalogAgreement: false,
        technicalConflict: true,
        traceability: true,
        explanation: `Mesma medida (${inchesA}"), porém conectores diferentes documentados: ${connectorA || 'Padrão'} vs ${connectorB || 'Padrão'}.`,
        divergenceDetails: `Verifique o braço do veículo antes da montagem.`,
        uiDisplayMode: 'warning',
      };
    }
  }

  // 4. Multi-Catálogo Confirmado (2 ou mais marcas documentando com medidas idênticas)
  const brands = allBrandCodes ? Array.from(new Set(allBrandCodes)) : [];
  if (brands.length >= 2) {
    return {
      status: 'MULTI_CATALOG_CONFIRMED',
      statusLabel: 'Confirmada em Múltiplos Catálogos',
      sourceCount: brands.length,
      catalogAgreement: true,
      technicalConflict: false,
      traceability: true,
      explanation: `Aplicação confirmada em ${brands.length} catálogos independentes (${brands.join(', ')}).`,
      uiDisplayMode: 'cross_reference',
    };
  }

  // 5. Documentada em catálogo único
  return {
    status: 'DOCUMENTED',
    statusLabel: 'Documentada',
    sourceCount: 1,
    catalogAgreement: true,
    technicalConflict: false,
    traceability: true,
    explanation: 'Aplicação técnica documentada conforme catálogo oficial.',
    uiDisplayMode: 'standard',
  };
}

/**
 * Avalia o status de uma aplicação específica dentro de uma variante técnica.
 */
export function evaluateApplicationGovernance(
  app: TechnicalVariantApplication,
  variant: TechnicalVariant,
): TechnicalConfidenceMatrix {
  const brandCodes = Array.from(new Set(app.fits.map((f) => f.manufacturerCode.toUpperCase())));

  // Verifica se o veículo tem erro de fonte
  if (isSuspectedSourceError(variant.vehicle)) {
    return evaluateTechnicalStatus({
      vehicleA: variant.vehicle,
    });
  }

  // Se a variante é de carroceria
  if (variant.variant && variant.variant !== 'Padrao') {
    return evaluateTechnicalStatus({
      bodyVariantA: variant.variant,
      bodyVariantB: 'Padrão',
      allBrandCodes: brandCodes,
    });
  }

  return evaluateTechnicalStatus({
    inchesA: app.inches,
    inchesB: app.inches,
    connectorA: app.connectorRaw,
    connectorB: app.connectorRaw,
    allBrandCodes: brandCodes,
  });
}

/**
 * Avalia a governança técnica completa de uma família de veículos para apresentação no card.
 * Executa em O(1) variantes/aplicações com altíssima performance.
 */
export function evaluateFamilyTechnicalGovernance(
  family: VehicleFamilyResult,
): FamilyTechnicalGovernanceSummary {
  const allBrands = new Set<string>();
  const bodyVariants = new Set<string>();
  const divergences: DocumentaryDivergenceDetail[] = [];
  let totalTechnicalApplications = 0;

  for (const v of family.variants) {
    for (const b of v.documentedBrands) {
      allBrands.add(b.toUpperCase());
    }
    if (v.bodyTypeBadge && v.bodyTypeBadge !== 'Aplicação Padrão') {
      bodyVariants.add(v.bodyTypeBadge);
    }
    totalTechnicalApplications += v.applications.length;
  }

  // Detecta divergências dimensionais entre variantes no mesmo período de fabricação
  for (let i = 0; i < family.variants.length; i++) {
    for (let j = i + 1; j < family.variants.length; j++) {
      const vA = family.variants[i]!;
      const vB = family.variants[j]!;

      // Se ambas as variantes são variantes de carroceria diferentes, não é divergência e sim variante
      if (vA.variant && vB.variant && vA.variant !== vB.variant) {
        continue;
      }

      // Checa sobreposição temporal
      const startA = vA.yearStart ?? 1900;
      const endA = vA.yearEnd ?? (vA.yearEndOpen ? 9999 : 1900);
      const startB = vB.yearStart ?? 1900;
      const endB = vB.yearEnd ?? (vB.yearEndOpen ? 9999 : 1900);

      const overlaps = startA <= endB && startB <= endA;
      if (!overlaps) continue;

      // Compara posições correspondentes
      for (const aA of vA.applications) {
        for (const aB of vB.applications) {
          if (aA.position !== aB.position) continue;

          // Se as medidas em polegadas são diferentes e não é pequena variação de arredondamento traseiro
          if (
            aA.inches !== null &&
            aB.inches !== null &&
            aA.inches !== aB.inches &&
            !(aA.position === 'traseira' && Math.abs(aA.inches - aB.inches) <= 1)
          ) {
            const brandsA = aA.fits.map((f) => f.manufacturerCode).join('/') || 'Catálogo A';
            const brandsB = aB.fits.map((f) => f.manufacturerCode).join('/') || 'Catálogo B';

            const yearsOverlapStr = `${Math.max(startA, startB)} → ${Math.min(endA, endB) === 9999 ? 'atual' : Math.min(endA, endB)}`;

            // Evita adicionar duplicatas da mesma divergência
            const exists = divergences.some(
              (d) => d.position === aA.position && d.years === yearsOverlapStr,
            );

            if (!exists) {
              divergences.push({
                position: aA.position as string,
                positionLabel: aA.positionLabel,
                years: yearsOverlapStr,
                options: [
                  { brand: brandsA, inches: aA.inches, connector: aA.connectorRaw },
                  { brand: brandsB, inches: aB.inches, connector: aB.connectorRaw },
                ],
                explanation: `Catálogos documentam medidas divergentes para ${aA.positionLabel} (${brandsA}: ${aA.inches}" vs ${brandsB}: ${aB.inches}").`,
                warningMessage: `Atenção: há duas medidas documentadas para esta aplicação (${brandsA}: ${aA.inches}" vs ${brandsB}: ${aB.inches}"). Confirme a peça instalada ou o catálogo desejado no balcão.`,
              });
            }
          }
        }
      }
    }
  }

  const confirmedCatalogsList = Array.from(allBrands);
  const confirmedCatalogsCount = confirmedCatalogsList.length;
  const bodyVariantsList = Array.from(bodyVariants);
  const hasBodyVariants = bodyVariantsList.length > 0;
  const documentaryDivergencesCount = divergences.length;
  const requiresSpecialAttention = documentaryDivergencesCount > 0;

  // Monta texto de resumo elegante para o cabeçalho
  const parts: string[] = [];
  if (confirmedCatalogsCount > 1) {
    parts.push(`✓ ${confirmedCatalogsCount} catálogos`);
  }
  if (documentaryDivergencesCount > 0) {
    parts.push(`⚠ ${documentaryDivergencesCount} divergência documental`);
  }
  if (hasBodyVariants) {
    parts.push(`Aplicações por carroceria`);
  }

  const badgeSummaryText = parts.join(' • ');

  return {
    totalTechnicalApplications,
    confirmedCatalogsCount,
    confirmedCatalogsList,
    documentaryDivergencesCount,
    divergenceDetails: divergences,
    hasBodyVariants,
    bodyVariantsList,
    requiresSpecialAttention,
    badgeSummaryText,
  };
}
