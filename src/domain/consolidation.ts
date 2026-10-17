import type { SearchResultItem } from '@/search/search-engine';
import type {
  Connector,
  MatchedApplicationFit,
  Position,
  TechnicalVariant,
  TechnicalVariantApplication,
  Vehicle,
  VehicleApplication,
  VehicleCategory,
  VehicleFamilyResult,
} from './types';
import { normalizeText, titleCase } from './normalize';
import { resolveMillimeters } from './measures';
import { yearRangesOverlap } from './years';
import { canonicalizeManufacturer } from './manufacturers';
import {
  evaluateFamilyTechnicalGovernance,
  evaluateApplicationGovernance,
} from './governance';

export type { MatchedApplicationFit };

export interface ModelMetadata {
  family: string;
  generation?: string;
  variant?: string;
}

/**
 * Extrai a família do modelo automotivo e metadados estruturados de geração e variante,
 * eliminando ruídos de motorização (2.7, 3.0, 1.0, 16V, Turbo), combustíveis (Flex, Diesel),
 * acabamentos e versões de acabamento, preservando famílias distintas essenciais
 * (SW4, Weekend, Adventure, Cross, Fielder, Plus).
 */
export function extractModelMetadata(rawModel: string): ModelMetadata {
  let m = rawModel.toUpperCase();

  // 1. Correções de grafias conhecidas em catálogos
  m = m.replace(/\bHULUX\b/g, 'HILUX');
  m = m.replace(/\bGOLD\b/g, 'GOL');
  m = m.replace(/\bETIO\b/g, 'ETIOS');
  m = m.replace(/\bHB20\s*S\b/g, 'HB20S');
  m = m.replace(/\bHB20\s*X\b/g, 'HB20X');

  // 2. Preserva distinções de famílias / submodelos antes de limpar termos
  const isSW4 = /\b(?:SW4|SW)\b/i.test(m);
  const isWeekend = /\bWEEKEND\b/i.test(m);
  const isAdventure = /\bADVENTURE\b/i.test(m);
  const isCross = /\bCROSS\b/i.test(m) && !m.includes('CROSSFOX');
  const isFielder = /\bFIELDER\b/i.test(m);
  const isPlus = /\bPLUS\b/i.test(m);
  const isCabine = /\bCABINE\b/i.test(m);

  // 3. Extrai geração padronizada quando documentada
  let generation: string | undefined;
  if (/\b(?:G\s*VIII|GVIII|G\s*8|G8|VIII)\b/i.test(m)) generation = 'G8';
  else if (/\b(?:G\s*VII|GVII|G\s*7|G7|VII)\b/i.test(m)) generation = 'G7';
  else if (/\b(?:G\s*VI|GVI|G\s*6|G6|VI)\b/i.test(m)) generation = 'G6';
  else if (/\b(?:G\s*V|GV|G\s*5|G5|V)\b/i.test(m)) generation = 'G5';
  else if (/\b(?:G\s*IV|GIV|G\s*4|G4|IV)\b/i.test(m)) generation = 'G4';
  else if (/\b(?:G\s*III|GIII|G\s*3|G3|III)\b/i.test(m)) generation = 'G3';
  else if (/\b(?:G\s*II|GII|G\s*2|G2|II)\b/i.test(m)) generation = 'G2';
  else if (/\b(?:G\s*I|GI|G\s*1|G1|I)\b/i.test(m)) generation = 'G1';

  // 4. Extrai variante de carroceria ou edição documentada
  let variant: string | undefined;
  if (isCabine) variant = 'Cabine';
  else if (/\bSPECIAL\b/i.test(m)) variant = 'Special';
  else if (/\bQUADRADO\b/i.test(m)) variant = 'Quadrado';
  else if (/\bBOLINHA\b/i.test(m)) variant = 'Bolinha';
  else if (/\bSEDAN\b/i.test(m)) variant = 'Sedan';

  // 5. Limpeza de gerações da chave de família
  m = m.replace(
    /\b(?:G\s*VIII|GVIII|G\s*8|G8|VIII|G\s*VII|GVII|G\s*7|G7|VII|G\s*VI|GVI|G\s*6|G6|VI|G\s*V|GV|G\s*5|G5|V|G\s*IV|GIV|G\s*4|G4|IV|G\s*III|GIII|G\s*3|G3|III|G\s*II|GII|G\s*2|G2|II|G\s*I|GI|G\s*1|G1|I)\b/gi,
    ' ',
  );

  // 6. Limpeza de pontuação e caracteres separadores
  m = m.replace(/[*;,]/g, ' ');

  // 7. Remoção de motorização, cilindrada e válvulas
  m = m.replace(/\b\d\.\d(?:V)?\b/gi, ' ');
  m = m.replace(/\b(?:8V|16V|20V|24V|V6|V8|V10|V12|1000|MILLE)\b/gi, ' ');

  // 8. Remoção de combustíveis e tecnologias de motor
  m = m.replace(
    /\b(?:TOTAL\s*FLEX|FLEXPOWER|TRI-FLEX|FLEX|TURBO|INTERCOOLER|BITURBO|DIESEL|GASOLINA|ETANOL|ALCOOL|GNV|HIBRIDO|HYBRID|ELETRICO|EV)\b/gi,
    ' ',
  );
  m = m.replace(/\b(?:TSI|TFSI|MPI|THP|VTEC|I-VTEC|FIREFLY|FIRE|MI|POWER)\b/gi, ' ');

  // 9. Remoção de transmissões e tração
  m = m.replace(
    /\b(?:AUT\.|AUT|AUTOMATICO|MANUAL|CVT|DUALOGIC|I-MOTION|IMOTION|EASYTRONIC|4X4|4X2|AWD|4WD|4MATIC|QUATTRO)\b/gi,
    ' ',
  );

  // 10. Remoção de cabine, portas e carrocerias redundantes
  m = m.replace(/\b(?:CABINE\s*DUPLA|CABINE\s*SIMPLES|CABINE\s*ESTENDIDA|CABINE|2P|3P|4P|5P|2\s*PORTAS|4\s*PORTAS)\b/gi, ' ');
  m = m.replace(/\b(?:SEDAN|HATCH|HATCHBACK|COUPE|PERUA|WAGON)\b/gi, ' ');

  // 11. Remoção de pacotes de acabamento, séries e versões
  m = m.replace(/\b(?:XEI|GLI|ALTIS|XLI|SE-G|XR|XLS|GR-S|LT|LTZ|PREMIER|PREMIUM|JOY|ACTIV|ADVANTAGE|EFFECT|MIDNIGHT)\b/gi, ' ');
  m = m.replace(/\b(?:CL|GL|GLS|GTI|GTS|GT|SPORT|SPORTING|R\/T|SS)\b/gi, ' ');
  m = m.replace(
    /\b(?:ATTRACTIVE|ESSENCE|DYNAMIC|EVO|CELEBRATION|WAY|ECONOMY|DRIVE|TREND|TRENDLINE|COMFORTLINE|HIGHLINE|TRACK|SPECIAL|TITANIUM|FREESTYLE|ST|SE|SEL)\b/gi,
    ' ',
  );
  m = m.replace(/\b(?:FASE\s*[1-4]|QUADRADO|BOLINHA|NOVO|NOVA|SERIE|SÉRIE|GERACAO|GERAÇÃO)\b/gi, ' ');
  m = m.replace(/\b(?:BX|LS|CL|SL\/E|ALL)\b/gi, ' ');

  // Pega a primeira parte antes de barras ou parênteses
  let primary = m.split('/')[0]?.split('(')[0]?.trim() || m;
  let normalized = normalizeText(primary).replace(/\s+/g, ' ').trim();

  // Remove letras isoladas soltas que restaram de motorizações (ex: 'd' de D TURBO)
  normalized = normalized.replace(/\b[b-z]\b/g, '').replace(/\s+/g, ' ').trim();

  // Restaura sufixos essenciais de famílias distintas
  if (isSW4 && !normalized.includes('sw4')) normalized = `${normalized} sw4`.trim();
  if (isWeekend && !normalized.includes('weekend')) normalized = `${normalized} weekend`.trim();
  if (isAdventure && !normalized.includes('adventure')) normalized = `${normalized} adventure`.trim();
  if (isCross && !normalized.includes('cross')) normalized = `${normalized} cross`.trim();
  if (isFielder && !normalized.includes('fielder')) normalized = `${normalized} fielder`.trim();
  if (isPlus && !normalized.includes('plus')) normalized = `${normalized} plus`.trim();

  return {
    family: normalized,
    generation,
    variant,
  };
}

/**
 * Normaliza o modelo para a chave de agrupamento da família do veículo.
 */
export function cleanVehicleModelFamily(rawModel: string): string {
  return extractModelMetadata(rawModel).family;
}

/**
 * Extrai a chave de agrupamento (Cluster Key) para unir registros redundantes
 * do mesmo veículo entre catálogos diferentes.
 */
export function getVehicleClusterKey(v: Vehicle): string {
  const brand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
  const family = cleanVehicleModelFamily(v.model);
  return `${brand}|${family}`;
}

const POSITION_LABELS: Record<string, string> = {
  motorista: 'Motorista',
  passageiro: 'Passageiro',
  par_dianteiro: 'Par Dianteiro',
  traseira: 'Traseira',
};

const POSITION_ORDER = ['motorista', 'passageiro', 'par_dianteiro', 'traseira'];

/**
 * Determina se dois registros de busca de veículo pertencem à mesma variante técnica,
 * garantindo que NÃO sejam fundidas faixas com medidas de palhetas divergentes,
 * gerações distintas ou anos não sobrepostos.
 */
export function areVehiclesSameTechnicalVariant(it1: SearchResultItem, it2: SearchResultItem): boolean {
  if (!it1.vehicle || !it2.vehicle) return false;
  const v1 = it1.vehicle;
  const v2 = it2.vehicle;

  const apps1 = (it1.matchedApplications || []).map((a) => a.application);
  const apps2 = (it2.matchedApplications || []).map((a) => a.application);

  // 1. CHECAGEM TÉCNICA CRÍTICA: Mesma posição NÃO pode ter medidas divergentes
  for (const a1 of apps1) {
    for (const a2 of apps2) {
      if (a1.position === a2.position) {
        if (a1.inches && a2.inches && a1.inches !== a2.inches) {
          // Tolerância para pequena divergência de arredondamento de polegadas traseiras entre catálogos (ex: 10" vs 10.5" = 254mm vs 266mm)
          if (a1.position === 'traseira' && Math.abs(a1.inches - a2.inches) <= 1) {
            continue;
          }
          return false; // Ex: Motorista 24" vs Motorista 26" NUNCA podem ser a mesma variante
        }
      }
    }
  }

  // 2. CHECAGEM DE GERAÇÃO: Gerações diferentes documentadas são variantes distintas
  const meta1 = extractModelMetadata(v1.model);
  const meta2 = extractModelMetadata(v2.model);
  if (meta1.generation && meta2.generation && meta1.generation !== meta2.generation) {
    return false;
  }
  if (meta1.variant && meta2.variant && meta1.variant !== meta2.variant) {
    return false;
  }

  // 3. CHECAGEM DE SOBREPOSIÇÃO DE ANOS
  const hasYears1 = v1.yearStart !== null || v1.yearEnd !== null;
  const hasYears2 = v2.yearStart !== null || v2.yearEnd !== null;
  if (!hasYears1 || !hasYears2) {
    return true;
  }

  if (!yearRangesOverlap(v1, v2)) {
    return false;
  }

  // Se ambos possuem ano de início definido e a distância é grande (> 3 anos),
  // pertencem a ciclos/gerações diferentes que não devem ser fundidos.
  if (v1.yearStart !== null && v2.yearStart !== null) {
    if (Math.abs(v1.yearStart - v2.yearStart) > 3) {
      return false;
    }
  }

  return true;
}

/**
 * Mapeamento de famílias derivadas para descoberta assistida e não poluente (Parte 13 da Fase 4).
 * Chave: '{marca_normalizada}.{família_normalizada}' -> Lista de famílias relacionadas.
 */
export const RELATED_FAMILIES_MAP: Record<string, string[]> = {
  'chevrolet.onix': ['Onix Plus'],
  'chevrolet.onix plus': ['Onix'],
  'toyota.corolla': ['Corolla Cross', 'Corolla Fielder'],
  'toyota.corolla cross': ['Corolla'],
  'toyota.corolla fielder': ['Corolla'],
  'hyundai.hb20': ['HB20S', 'HB20X'],
  'hyundai.hb20s': ['HB20'],
  'toyota.hilux': ['SW4'],
  'toyota.sw4': ['Hilux'],
  'toyota.hilux sw4': ['Hilux'],
};

/**
 * Consolida uma coleção de SearchResultItem em famílias de veículos (`VehicleFamilyResult`),
 * preservando todas as variantes técnicas documentadas, faixas de anos reais, medidas,
 * conexões, códigos por fabricante (DYNA, CINOY, VETOR) e rastreabilidade documental.
 */
export function consolidateVehicleFamilies(
  items: SearchResultItem[],
  filterYear?: number,
): SearchResultItem[] {
  const familyMap = new Map<
    string,
    {
      brand: string;
      family: string;
      category: VehicleCategory;
      items: SearchResultItem[];
      maxScore: number;
    }
  >();

  const productResults: SearchResultItem[] = [];

  for (const item of items) {
    if (item.type === 'product' || !item.vehicle) {
      productResults.push(item);
      continue;
    }

    const v = item.vehicle;
    const brand = canonicalizeManufacturer(v.brand) || v.brand;
    const family = cleanVehicleModelFamily(v.model);
    const key = `${normalizeText(brand)}|${family}`;

    if (!familyMap.has(key)) {
      familyMap.set(key, {
        brand,
        family,
        category: v.category,
        items: [],
        maxScore: item.score,
      });
    }

    const entry = familyMap.get(key)!;
    entry.items.push(item);
    if (item.score > entry.maxScore) {
      entry.maxScore = item.score;
    }
  }

  const familyResults: SearchResultItem[] = [];

  for (const [key, data] of familyMap.entries()) {
    // 1. Agrupa os itens do veículo em variantes técnicas coerentes
    const variantGroups: Array<{ items: SearchResultItem[] }> = [];

    for (const item of data.items) {
      let matchedGroup: { items: SearchResultItem[] } | null = null;
      for (const group of variantGroups) {
        if (areVehiclesSameTechnicalVariant(group.items[0]!, item)) {
          matchedGroup = group;
          break;
        }
      }

      if (matchedGroup) {
        matchedGroup.items.push(item);
      } else {
        variantGroups.push({ items: [item] });
      }
    }

    // 2. Constrói cada variante técnica consolidando aplicações sem perda
    const builtVariants: TechnicalVariant[] = variantGroups.map((group, groupIdx) => {
      const vehicles = group.items.map((x) => x.vehicle!).filter(Boolean);
      const validStarts = vehicles.map((v) => v.yearStart).filter((y): y is number => y !== null);
      const validEnds = vehicles.map((v) => v.yearEnd).filter((y): y is number => y !== null);

      const yearStart = validStarts.length > 0 ? Math.min(...validStarts) : vehicles[0]?.yearStart ?? null;
      const yearEnd = validEnds.length > 0 ? Math.max(...validEnds) : vehicles[0]?.yearEnd ?? null;
      const yearEndOpen = vehicles.some((v) => v.yearEndOpen || (v.yearStart !== null && v.yearEnd === null));

      let yearRaw = vehicles[0]?.yearRaw || 'Ano não informado';
      if (yearStart !== null) {
        if (yearEndOpen) {
          yearRaw = `${yearStart} em diante`;
        } else if (yearEnd !== null && yearEnd !== yearStart) {
          yearRaw = `${yearStart} → ${yearEnd}`;
        } else if (yearEnd !== null) {
          yearRaw = `${yearStart}`;
        } else {
          yearRaw = `${yearStart} em diante`;
        }
      }

      const meta = extractModelMetadata(vehicles[0]?.model || '');
      
      let bodyTypeBadge = 'Aplicação Padrão';
      if (meta.variant === 'Cabine') bodyTypeBadge = 'Carroceria Cabine';
      else if (meta.variant === 'Special') bodyTypeBadge = 'Série Especial';
      else if (meta.variant === 'Quadrado') bodyTypeBadge = 'Geração Quadrado';
      else if (meta.variant === 'Bolinha') bodyTypeBadge = 'Geração Bolinha';
      else if (meta.variant === 'Sedan') bodyTypeBadge = 'Versão Sedan';

      let label = yearRaw;
      if (meta.variant && meta.generation) {
        label = `${meta.generation} • ${meta.variant} — ${yearRaw}`;
      } else if (meta.variant) {
        label = `${meta.variant} — ${yearRaw}`;
      } else if (meta.generation) {
        label = `${meta.generation} — ${yearRaw}`;
      }

      // Consolidação de aplicações técnicas por posição dentro da variante
      const appMap = new Map<
        string,
        {
          application: VehicleApplication;
          connector?: Connector;
          fitsMap: Map<string, MatchedApplicationFit>;
        }
      >();

      for (const it of group.items) {
        for (const ma of it.matchedApplications || []) {
          const pos = ma.application.position;
          if (!appMap.has(pos)) {
            appMap.set(pos, {
              application: { ...ma.application },
              connector: ma.connector,
              fitsMap: new Map(),
            });
          }
          const target = appMap.get(pos)!;

          // Preserva medida dimensional documentada mais precisa
          if (!target.application.inches && ma.application.inches) {
            target.application.inches = ma.application.inches;
            target.application.millimeters = ma.application.millimeters;
            target.application.sizeLabel = ma.application.sizeLabel;
          }
          if (!target.connector && ma.connector) {
            target.connector = ma.connector;
          }

          for (const f of ma.fits) {
            const fitKey = `${f.manufacturerCode.toUpperCase()}:${f.product.code}`;
            if (!target.fitsMap.has(fitKey)) {
              target.fitsMap.set(fitKey, {
                product: f.product,
                manufacturerCode: f.manufacturerCode,
                relationType: f.relationType,
                sources: [...f.sources],
                notes: f.notes,
              });
            } else {
              const existing = target.fitsMap.get(fitKey)!;
              if (f.relationType === 'catalog_documented') {
                existing.relationType = 'catalog_documented';
              }
              for (const s of f.sources) {
                if (!existing.sources.some((x) => x.id === s.id)) {
                  existing.sources.push(s);
                }
              }
            }
          }
        }
      }

      const applications: TechnicalVariantApplication[] = Array.from(appMap.entries())
        .sort((a, b) => {
          const idxA = POSITION_ORDER.indexOf(a[0]);
          const idxB = POSITION_ORDER.indexOf(b[0]);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        })
        .map(([pos, d]) => ({
          id: d.application.id,
          position: pos,
          positionLabel: POSITION_LABELS[pos] || pos,
          inches: d.application.inches,
          millimeters: resolveMillimeters(d.application.inches, d.application.millimeters),
          sizeLabel: d.application.sizeLabel,
          connectorRaw: d.application.connectorRaw,
          connector: d.connector,
          measureOrigin: d.application.measureOrigin,
          fits: Array.from(d.fitsMap.values()),
        }));

      const documentedBrands = Array.from(
        new Set(
          applications.flatMap((a) => a.fits.map((f) => f.manufacturerCode.toUpperCase())),
        ),
      );

      const sourceIds = Array.from(
        new Set([
          ...vehicles.flatMap((v) => v.sourceIds),
          ...applications.flatMap((a) => a.fits.flatMap((f) => f.sources.map((s) => s.id))),
        ]),
      );

      const primaryVehicle: Vehicle = {
        ...vehicles[0]!,
        yearStart,
        yearEnd: yearEndOpen ? null : yearEnd,
        yearEndOpen,
        yearRaw,
        sourceIds,
      };

      const variantItem: TechnicalVariant = {
        id: `var_${meta.family}_${groupIdx}_${yearStart ?? 'x'}_${yearEnd ?? 'x'}`,
        label,
        yearStart,
        yearEnd,
        yearEndOpen,
        yearRaw,
        generation: meta.generation,
        variant: meta.variant,
        bodyTypeBadge,
        vehicle: primaryVehicle,
        sourceIds,
        vehicleIds: vehicles.map((v) => v.id),
        applications,
        documentedBrands,
      };

      for (const app of applications) {
        const matrix = evaluateApplicationGovernance(app, variantItem);
        app.confidenceMatrix = matrix;
        app.technicalStatus = matrix.status;
      }

      return variantItem;
    });

    // Ordenação cronológica das variantes (mais recentes primeiro)
    builtVariants.sort((a, b) => {
      const startA = a.yearStart ?? 0;
      const startB = b.yearStart ?? 0;
      return startB - startA;
    });

    // Se houver filtro específico de ano (ex: HILUX 2015 ou filtro de ano = 2015),
    // seleciona estritamente a(s) variante(s) que cobrem esse ano!
    const activeVariants =
      filterYear !== undefined
        ? builtVariants.filter((v) => {
            if (v.yearStart !== null && filterYear < v.yearStart) return false;
            if (!v.yearEndOpen && v.yearEnd !== null && filterYear > v.yearEnd) return false;
            return true;
          })
        : builtVariants;

    // Se o filtro de ano eliminou todas as variantes desta família, descarta a família
    if (activeVariants.length === 0) {
      continue;
    }

    const allDocumentedBrands = Array.from(
      new Set(activeVariants.flatMap((v) => v.documentedBrands)),
    );

    const allSourceIds = Array.from(
      new Set(activeVariants.flatMap((v) => v.sourceIds)),
    );

    // Formata o nome canônico do modelo para exibição
    const canonicalModel = titleCase(data.family);
    const fullName = `${data.brand} ${canonicalModel}`;

    const brandFamilyKey = `${normalizeText(canonicalizeManufacturer(data.brand) || data.brand)}.${data.family}`;
    const relatedFamilies = RELATED_FAMILIES_MAP[brandFamilyKey];

    // Detecta Anos de Transição (mudança de geração, medida ou conector em anos sobrepostos ou limítrofes)
    const transitionYearsSet = new Set<string>();
    for (let i = 0; i < activeVariants.length; i++) {
      for (let j = i + 1; j < activeVariants.length; j++) {
        const vA = activeVariants[i]!;
        const vB = activeVariants[j]!;

        // Ignora comparação se forem variantes de carrocerias diferentes (ex: Cabine vs Padrão)
        if (vA.variant && vB.variant && vA.variant !== vB.variant) continue;

        const startA = vA.yearStart;
        const endA = vA.yearEnd ?? (vA.yearEndOpen && startA !== null ? 2026 : startA);
        const startB = vB.yearStart;
        const endB = vB.yearEnd ?? (vB.yearEndOpen && startB !== null ? 2026 : startB);

        if (startA === null || endA === null || startB === null || endB === null) continue;

        const overlapStart = Math.max(startA, startB);
        const overlapEnd = Math.min(endA, endB);
        if (overlapStart > overlapEnd) continue;

        // Checa se há diferença de geração, medida ou conector no ano de sobreposição/transição
        const diffGen = Boolean(vA.generation && vB.generation && vA.generation !== vB.generation);
        let diffSpec = diffGen;

        for (const aA of vA.applications) {
          for (const aB of vB.applications) {
            if (aA.position !== aB.position) continue;
            const diffInch =
              aA.inches !== null &&
              aB.inches !== null &&
              aA.inches !== aB.inches &&
              !(aA.position === 'traseira' && Math.abs(aA.inches - aB.inches) <= 1);
            const connA = normalizeText(aA.connectorRaw || 'padrao');
            const connB = normalizeText(aB.connectorRaw || 'padrao');
            const diffConn = connA !== connB;
            if (diffInch || diffConn) {
              diffSpec = true;
              break;
            }
          }
          if (diffSpec) break;
        }

        if (diffSpec) {
          const transLabel = overlapStart === overlapEnd ? `${overlapStart}` : `${overlapStart}–${overlapEnd}`;
          transitionYearsSet.add(transLabel);
          vA.hasTransitionWarning = true;
          vB.hasTransitionWarning = true;
          vA.transitionWarningText = `Ano de transição (${transLabel}): confirme geração/conector no veículo`;
          vB.transitionWarningText = `Ano de transição (${transLabel}): confirme geração/conector no veículo`;
        }
      }
    }

    const transitionYears = Array.from(transitionYearsSet);
    const hasTransitionWarning = transitionYears.length > 0;

    const familyResult: VehicleFamilyResult = {
      id: `fam_${key.replace(/[^a-z0-9]/gi, '_')}`,
      type: 'vehicle_family',
      brand: data.brand,
      model: canonicalModel,
      fullName,
      category: data.category,
      variants: activeVariants,
      totalVariants: activeVariants.length,
      documentedBrands: allDocumentedBrands,
      sourceIds: allSourceIds,
      selectedYear: filterYear,
      relatedFamilies: relatedFamilies && relatedFamilies.length > 0 ? relatedFamilies : undefined,
      hasTransitionWarning,
      transitionYears: transitionYears.length > 0 ? transitionYears : undefined,
    };

    familyResult.governance = evaluateFamilyTechnicalGovernance(familyResult);

    // Para compatibilidade com interfaces e testes existentes que acessam
    // `item.vehicle` ou `item.matchedApplications`
    const primaryVariant = activeVariants[0];
    const legacyMatchedApplications = primaryVariant?.applications.map((app) => ({
      application: {
        id: app.id || '',
        vehicleId: primaryVariant.vehicle.id,
        position: app.position as Position,
        inches: app.inches,
        millimeters: app.millimeters,
        sourceInches: app.inches,
        sourceMillimeters: app.millimeters,
        calculatedMillimeters: app.millimeters,
        sizeLabel: app.sizeLabel || null,
        measureOrigin: app.measureOrigin ?? 'application_table',
        connectorRaw: app.connectorRaw,
        sourceIds: app.fits.flatMap((f) => f.sources.map((s) => s.id)),
      },
      connector: app.connector,
      fits: app.fits.map((f) => ({
        product: f.product,
        manufacturerCode: f.manufacturerCode,
        relationType: f.relationType,
        sources: f.sources,
        notes: f.notes,
      })),
    }));

    familyResults.push({
      id: familyResult.id,
      type: 'vehicle_family',
      score: data.maxScore,
      family: familyResult,
      vehicle: primaryVariant?.vehicle,
      matchedApplications: legacyMatchedApplications,
    });
  }

  // Ordena famílias priorizando correspondência exata do modelo e relevância
  familyResults.sort((a, b) => (b.score || 0) - (a.score || 0));

  return [...familyResults, ...productResults];
}

/**
 * Método de consolidação original mantido para compatibilidade retrospectiva com testes unitários.
 */
export function consolidateVehicleResults(items: SearchResultItem[]): SearchResultItem[] {
  return consolidateVehicleFamilies(items);
}
