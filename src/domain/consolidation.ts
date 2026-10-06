import type { SearchResultItem } from '@/search/search-engine';
import type { BrandProduct, CatalogSource, Connector, RelationType, Vehicle, VehicleApplication } from './types';
import { normalizeText } from './normalize';
import { yearRangesOverlap } from './years';
import { canonicalizeManufacturer } from './manufacturers';

export interface MatchedApplicationFit {
  product: BrandProduct;
  manufacturerCode: string;
  relationType: RelationType | 'catalog_documented';
  sources: CatalogSource[];
  notes?: string;
}

/**
 * Normaliza o modelo automotivo eliminando ruídos de motorização (2.7, 3.0, 1.0, 16V, Turbo),
 * combustíveis (Flex, Diesel), acabamentos e variações de grafia de gerações (G1..G8, I..VIII),
 * preservando famílias distintas essenciais (SW4, Weekend, Adventure, Cross, Fielder).
 */
export function cleanVehicleModelFamily(rawModel: string): string {
  let m = rawModel.toUpperCase();

  // 1. Correções de erros ortográficos de catálogos
  m = m.replace(/\bHULUX\b/g, 'HILUX');
  m = m.replace(/\bGOLD\b/g, 'GOL');
  m = m.replace(/\bETIO\b/g, 'ETIOS');

  // 2. Preserva distinções de famílias / submodelos antes de limpar termos
  const isSW4 = /\b(?:SW4|SW)\b/i.test(m);
  const isWeekend = /\bWEEKEND\b/i.test(m);
  const isAdventure = /\bADVENTURE\b/i.test(m);
  const isCross = /\bCROSS\b/i.test(m) && !m.includes('CROSSFOX');
  const isFielder = /\bFIELDER\b/i.test(m);

  // 3. Normalização universal de gerações (G1..G8 / I..VIII / Fases)
  m = m.replace(/\b(?:G\s*VIII|GVIII|G\s*8|G8|VIII)\b/g, ' G8 ');
  m = m.replace(/\b(?:G\s*VII|GVII|G\s*7|G7|VII)\b/g, ' G7 ');
  m = m.replace(/\b(?:G\s*VI|GVI|G\s*6|G6|VI)\b/g, ' G6 ');
  m = m.replace(/\b(?:G\s*V|GV|G\s*5|G5|V)\b/g, ' G5 ');
  m = m.replace(/\b(?:G\s*IV|GIV|G\s*4|G4|IV)\b/g, ' G4 ');
  m = m.replace(/\b(?:G\s*III|GIII|G\s*3|G3|III)\b/g, ' G3 ');
  m = m.replace(/\b(?:G\s*II|GII|G\s*2|G2|II)\b/g, ' G2 ');
  m = m.replace(/\b(?:G\s*I|GI|G\s*1|G1|I)\b/g, ' G1 ');

  // 4. Limpeza de caracteres pontuais e separadores
  m = m.replace(/[*;,]/g, ' ');

  // 5. Remoção de motorização, cilindrada e válvulas
  m = m.replace(/\b\d\.\d(?:V)?\b/gi, ' ');
  m = m.replace(/\b(?:8V|16V|20V|24V|V6|V8|V10|V12|1000|MILLE)\b/gi, ' ');

  // 6. Remoção de combustíveis e tecnologias de motor
  m = m.replace(/\b(?:TOTAL\s*FLEX|FLEXPOWER|TRI-FLEX|FLEX|TURBO|INTERCOOLER|BITURBO|DIESEL|GASOLINA|ETANOL|ALCOOL|GNV|HIBRIDO|HYBRID|ELETRICO|EV)\b/gi, ' ');
  m = m.replace(/\b(?:TSI|TFSI|MPI|THP|VTEC|I-VTEC|FIREFLY|FIRE|MI|POWER)\b/gi, ' ');

  // 7. Remoção de transmissões e tração
  m = m.replace(/\b(?:AUT\.|AUT|AUTOMATICO|MANUAL|CVT|DUALOGIC|I-MOTION|IMOTION|EASYTRONIC|4X4|4X2|AWD|4WD|4MATIC|QUATTRO)\b/gi, ' ');

  // 8. Remoção de formatos de cabine, portas e carrocerias que usam as mesmas palhetas
  m = m.replace(/\b(?:CABINE\s*DUPLA|CABINE\s*SIMPLES|CABINE\s*ESTENDIDA|CABINE|2P|3P|4P|5P|2\s*PORTAS|4\s*PORTAS)\b/gi, ' ');
  m = m.replace(/\b(?:SEDAN|HATCH|HATCHBACK|COUPE|PERUA|WAGON)\b/gi, ' ');

  // 9. Remoção de pacotes de acabamento, séries e versões
  m = m.replace(/\b(?:XEI|GLI|ALTIS|XLI|SE-G|XR|XLS|GR-S|LT|LTZ|PREMIER|JOY|ACTIV|ADVANTAGE|EFFECT|MIDNIGHT)\b/gi, ' ');
  m = m.replace(/\b(?:CL|GL|GLS|GTI|GTS|GT|SPORT|SPORTING|R\/T|SS)\b/gi, ' ');
  m = m.replace(/\b(?:ATTRACTIVE|ESSENCE|DYNAMIC|EVO|CELEBRATION|WAY|ECONOMY|DRIVE|TREND|TRENDLINE|COMFORTLINE|HIGHLINE|TRACK|SPECIAL|TITANIUM|FREESTYLE|ST|SE|SEL)\b/gi, ' ');
  m = m.replace(/\b(?:FASE\s*[1-4]|QUADRADO|BOLINHA|NOVO|NOVA|SERIE|SÉRIE|GERACAO|GERAÇÃO)\b/gi, ' ');
  m = m.replace(/\b(?:BX|LS|CL|SL\/E|ALL)\b/gi, ' ');

  // Pega a primeira parte antes de barras ou parênteses
  let primary = m.split('/')[0]?.split('(')[0]?.trim() || m;
  let normalized = normalizeText(primary).replace(/\s+/g, ' ').trim();

  // Remove letras isoladas soltas que restaram de motorizações (ex: 'd' de D TURBO)
  normalized = normalized.replace(/\b[b-z]\b/g, '').replace(/\s+/g, ' ').trim();

  // Restaura sufixos essenciais
  if (isSW4 && !normalized.includes('sw4')) normalized = `${normalized} sw4`.trim();
  if (isWeekend && !normalized.includes('weekend')) normalized = `${normalized} weekend`.trim();
  if (isAdventure && !normalized.includes('adventure')) normalized = `${normalized} adventure`.trim();
  if (isCross && !normalized.includes('cross')) normalized = `${normalized} cross`.trim();
  if (isFielder && !normalized.includes('fielder')) normalized = `${normalized} fielder`.trim();

  return normalized;
}

/**
 * Extrai a chave de agrupamento (Cluster Key) para unir registros redundantes
 * do mesmo veículo entre catálogos diferentes (DYNA, CINOY, VETOR).
 */
export function getVehicleClusterKey(v: Vehicle): string {
  const brand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
  const family = cleanVehicleModelFamily(v.model);
  return `${brand}|${family}`;
}

/**
 * Consolida itens de resultado de busca eliminando quadros redundantes do mesmo veículo.
 * Combina aplicações das 3 marcas (DYNA, CINOY, VETOR) em uma única visão unificada por posição.
 */
export function consolidateVehicleResults(items: SearchResultItem[]): SearchResultItem[] {
  const groups: Array<{ primary: SearchResultItem; items: SearchResultItem[]; family: string; brand: string }> = [];

  for (const item of items) {
    if (item.type !== 'vehicle' || !item.vehicle) {
      groups.push({ primary: item, items: [item], family: '', brand: '' });
      continue;
    }

    const v = item.vehicle;
    const brand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
    const family = cleanVehicleModelFamily(v.model);

    const existing = groups.find((g) => {
      if (!g.primary.vehicle) return false;
      if (g.brand !== brand) return false;

      const famMatch =
        g.family === family ||
        (g.family.startsWith(family) && !g.family.includes('sw4') && !family.includes('sw4')) ||
        (family.startsWith(g.family) && !g.family.includes('sw4') && !family.includes('sw4'));

      if (!famMatch) return false;

      return g.items.some((other) => {
        if (!other.vehicle) return false;
        if (
          (v.yearStart === null && v.yearEnd === null) ||
          (other.vehicle.yearStart === null && other.vehicle.yearEnd === null)
        ) {
          return true;
        }
        return yearRangesOverlap(v, other.vehicle);
      });
    });

    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ primary: item, items: [item], family, brand });
    }
  }

  return groups.map((g) => {
    if (g.primary.type !== 'vehicle' || !g.primary.vehicle) {
      return g.primary;
    }

    const vehicles = g.items.map((x) => x.vehicle!).filter(Boolean);
    const validStarts = vehicles.map((v) => v.yearStart).filter((y): y is number => y !== null);
    const validEnds = vehicles.map((v) => v.yearEnd).filter((y): y is number => y !== null);
    const minStart = validStarts.length > 0 ? Math.min(...validStarts) : g.primary.vehicle?.yearStart ?? null;
    const maxEnd = validEnds.length > 0 ? Math.max(...validEnds) : g.primary.vehicle?.yearEnd ?? null;
    const hasOpenEnd = vehicles.some((v) => v.yearEndOpen || (v.yearStart !== null && v.yearEnd === null));

    // Seleciona o nome mais limpo e conciso para exibição
    const sortedModels = [...vehicles].sort((a, b) => a.model.length - b.model.length);
    let model = sortedModels[0]?.model || g.primary.vehicle!.model;
    if (g.family.includes('sw4') && !model.toUpperCase().includes('SW4')) {
      model = `${model} SW4`;
    }

    let yearRaw = g.primary.vehicle?.yearRaw || 'Ano não especificado';
    if (minStart !== null) {
      if (hasOpenEnd) {
        yearRaw = `${minStart} em diante`;
      } else if (maxEnd !== null && maxEnd !== minStart) {
        yearRaw = `${minStart} → ${maxEnd}`;
      } else if (maxEnd !== null) {
        yearRaw = `${minStart}`;
      } else {
        yearRaw = `${minStart} em diante`;
      }
    }

    const sourceIds = Array.from(new Set(vehicles.flatMap((v) => v.sourceIds)));
    const mergedVehicle: Vehicle = {
      ...g.primary.vehicle!,
      id: g.primary.vehicle!.id,
      model,
      yearStart: minStart,
      yearEnd: hasOpenEnd ? null : maxEnd,
      yearEndOpen: hasOpenEnd,
      yearRaw,
      sourceIds,
    };

    // Ordem padronizada e lógica de posições automotivas
    const posOrder = ['motorista', 'passageiro', 'par_dianteiro', 'traseira'];
    const appMap = new Map<
      string,
      {
        application: VehicleApplication;
        connector?: Connector;
        fitsMap: Map<string, MatchedApplicationFit>;
      }
    >();

    for (const item of g.items) {
      for (const ma of item.matchedApplications || []) {
        const pos = ma.application.position;
        if (!appMap.has(pos)) {
          appMap.set(pos, {
            application: { ...ma.application },
            connector: ma.connector,
            fitsMap: new Map(),
          });
        }
        const target = appMap.get(pos)!;

        // Prioriza dados dimensionais documentados
        if (!target.application.inches && ma.application.inches) {
          target.application.inches = ma.application.inches;
          target.application.millimeters = ma.application.millimeters;
          target.application.sizeLabel = ma.application.sizeLabel;
        }
        if (!target.connector && ma.connector) {
          target.connector = ma.connector;
        }

        // Consolida e deduplica palhetas compatíveis por código de produto
        for (const f of ma.fits) {
          const key = `${f.manufacturerCode}:${f.product.code}`;
          if (!target.fitsMap.has(key)) {
            target.fitsMap.set(key, { ...f, sources: [...f.sources] });
          } else {
            const existingFit = target.fitsMap.get(key)!;
            if (f.relationType === 'catalog_documented') {
              existingFit.relationType = 'catalog_documented';
            }
            for (const s of f.sources) {
              if (!existingFit.sources.some((x: CatalogSource) => x.id === s.id)) {
                existingFit.sources.push(s);
              }
            }
          }
        }
      }
    }

    const matchedApplications = Array.from(appMap.entries())
      .sort((a, b) => {
        const idxA = posOrder.indexOf(a[0]);
        const idxB = posOrder.indexOf(b[0]);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      })
      .map(([_, data]) => ({
        application: data.application,
        connector: data.connector,
        fits: Array.from(data.fitsMap.values()),
      }));

    return {
      ...g.primary,
      id: mergedVehicle.id,
      vehicle: mergedVehicle,
      matchedApplications,
    };
  });
}
