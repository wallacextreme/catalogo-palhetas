import type {
  BrandProduct,
  Catalog,
  CatalogSource,
  Connector,
  ImportRecord,
  Manufacturer,
  ProductFit,
  Vehicle,
  VehicleApplication,
} from '@/domain/types';
import type { ParseResult, RawExtraction } from '../types';
import { stableId } from '@/domain/ids';
import { inchesToMillimeters, parseInches } from '@/domain/measures';
import { parseYearRange } from '@/domain/years';
import { vehicleExclusionReason } from '@/domain/vehicle-category';
import { compactCode, normalizeText, titleCase } from '@/domain/normalize';

export function parseCinoyCatalog(raw: RawExtraction): ParseResult {
  const mfrId = stableId('mfr', 'CINOY');
  const catId = stableId('cat', 'CINOY', 2023);

  const manufacturer: Manufacturer = {
    id: mfrId,
    code: 'CINOY',
    name: 'Cinoy',
    active: true,
    roles: ['wiper_blade'],
  };

  const catalog: Catalog = {
    id: catId,
    manufacturerId: mfrId,
    catalogName: 'Catálogo de Acessórios',
    catalogYear: 2023,
    fileName: raw.file,
    sha256: raw.sha256,
    pageCount: raw.pageCount,
  };

  const sourcesMap = new Map<string, CatalogSource>();
  function getSource(page: number, section: string): string {
    const sId = stableId('src', catId, page, section);
    if (!sourcesMap.has(sId)) {
      sourcesMap.set(sId, {
        id: sId,
        catalogId: catId,
        manufacturer: 'CINOY',
        catalogName: 'Catálogo de Acessórios',
        catalogYear: 2023,
        page,
        section,
        sourceReference: `CINOY — Catálogo 2023 — Página ${page}`,
      });
    }
    return sId;
  }

  const connectorsMap = new Map<string, Connector>();
  function ensureConnector(code: string, sourceId: string): string {
    const cleanCode = code.toUpperCase().trim();
    if (!connectorsMap.has(cleanCode)) {
      const cId = stableId('con', 'CINOY', cleanCode);
      connectorsMap.set(cleanCode, {
        id: cId,
        canonicalCode: `CINOY:${cleanCode}`,
        code: cleanCode,
        manufacturerId: mfrId,
        name: `Encaixe ${cleanCode}`,
        aliases: [cleanCode, `Cinoy Encaixe ${cleanCode}`],
        manufacturerMappings: { CINOY: [cleanCode] },
        sourceIds: [sourceId],
      });
    }
    return connectorsMap.get(cleanCode)!.id;
  }

  const productsMap = new Map<string, BrandProduct>();
  const vehiclesMap = new Map<string, Vehicle>();
  const applications: VehicleApplication[] = [];
  const fits: ProductFit[] = [];
  const excludedItems: Array<{ source: string; reason: string; item: string }> = [];
  const warnings: string[] = [];

const KNOWN_MODEL_BRANDS: Array<{ brand: string; models: string[] }> = [
  { brand: 'Toyota', models: ['etios', 'corolla', 'hilux', 'sw4', 'yaris', 'prius', 'rav4', 'camry', 'corona', 'bandeirante', 'paseo'] },
  { brand: 'Chevrolet', models: ['onix', 'prisma', 'celta', 'corsa', 'tracker', 'spin', 'cruze', 'cobalt', 'agile', 'montana', 'meriva', 'zafira', 'vectra', 'astra', 'chevette', 'opala', 's10', 'blazer', 'equinox', 'sonic', 'classic'] },
  { brand: 'Volkswagen', models: ['gol', 'polo', 'virtus', 'voyage', 'fox', 'crossfox', 'spacefox', 'saveiro', 't-cross', 'nivus', 'taos', 'tiguan', 'jetta', 'passat', 'golf', 'up', 'amarok', 'santana', 'parati', 'fusca', 'kombi', 'bora'] },
  { brand: 'Fiat', models: ['uno', 'palio', 'mobi', 'argo', 'cronos', 'toro', 'strada', 'pulse', 'fastback', 'punto', 'linea', 'siena', 'grand siena', 'idea', 'bravo', 'doblo', 'fiorino', 'ducato', '500', 'tempra', 'tipo', 'marea', 'stilo'] },
  { brand: 'Ford', models: ['ka', 'fiesta', 'ecosport', 'focus', 'ranger', 'fusion', 'edge', 'territory', 'bronco', 'courier', 'escort', 'royale', 'verona'] },
  { brand: 'Hyundai', models: ['hb20', 'hb20s', 'hb20x', 'creta', 'i30', 'tucson', 'santa fe', 'ix35', 'azera', 'elantra', 'veloster', 'hr'] },
  { brand: 'Honda', models: ['civic', 'fit', 'city', 'hr-v', 'wr-v', 'cr-v', 'accord'] },
  { brand: 'Renault', models: ['kwid', 'sandero', 'logan', 'duster', 'captur', 'oroch', 'clio', 'megane', 'fluence', 'master', 'scenic', 'kangoo', 'stepway', 'symbol'] },
  { brand: 'Nissan', models: ['kicks', 'march', 'versa', 'sentra', 'frontier', 'tiida', 'livina', 'grand livina'] },
  { brand: 'Jeep', models: ['renegade', 'compass', 'commander', 'cherokee', 'grand cherokee', 'wrangler'] },
  { brand: 'Peugeot', models: ['206', '207', '208', '2008', '307', '308', '3008', '408', 'partner', 'boxer', 'expert', 'hoggar'] },
  { brand: 'Citroën', models: ['c3', 'c3 aircross', 'c4', 'c4 cactus', 'c4 picasso', 'c4 lounge', 'aircross', 'xsara', 'jumper', 'jumpy'] },
  { brand: 'Mitsubishi', models: ['l200', 'l200 triton', 'pajero', 'pajero tr4', 'pajero dakar', 'pajero sport', 'asx', 'outlander', 'eclipse cross', 'lancer'] },
  { brand: 'BMW', models: ['série 1', 'série 3', 'série 5', 'x1', 'x3', 'x5', 'x6'] },
  { brand: 'Mercedes-Benz', models: ['classe a', 'classe c', 'classe e', 'gla', 'glb', 'glc', 'sprinter'] },
  { brand: 'Audi', models: ['a1', 'a3', 'a4', 'a5', 'a6', 'q3', 'q5', 'q7'] },
  { brand: 'Kia', models: ['cerato', 'sportage', 'picanto', 'soul', 'sorento', 'seltos', 'carnival', 'bongo', 'besta'] },
  { brand: 'Suzuki', models: ['jimny', 'vitara', 'grand vitara', 'sx4', 'swift', 's-cross'] },
  { brand: 'JAC', models: ['j2', 'j3', 'j5', 'j6', 't40', 't5', 't50', 't6', 't60', 't8', 'iev'] },
  { brand: 'Chery', models: ['tiggo', 'qq', 'celer', 'arrizo'] },
  { brand: 'Volvo', models: ['xc40', 'xc60', 'xc90', 'v40', 'v60', 'c30', 's60'] },
];

function isValidCatalogYear(text: string): boolean {
  const t = text.trim();
  if (!t || /^(?:MODELO|ANO|CONEX|ENCAIXE|YN-|PALHETA|TRAS|DIANT)/i.test(t)) return false;
  return /(?:\b(?:19|20)\d\d|\b\d{2}[/>–\-]\d{2}\b|\b\d{2}[>–]\b|\b(?:19|20)\d\d[>–]\b)/.test(t);
}

function inferBrandFromModel(modelName: string): string | null {
  const norm = normalizeText(modelName);
  for (const group of KNOWN_MODEL_BRANDS) {
    if (group.models.some((m) => norm === normalizeText(m) || norm.startsWith(`${normalizeText(m)} `) || norm.startsWith(`${normalizeText(m)}/`))) {
      return group.brand;
    }
  }
  return null;
}

  for (const page of raw.pages) {
    const pageNum = page.page;
    if (pageNum < 65 || pageNum > 227) continue;

    // Páginas 167 a 176 são PALHETAS DE CAMINHÃO -> Exclusão estrita de linha pesada!
    if (pageNum >= 167 && pageNum <= 176) {
      excludedItems.push({
        source: `Cinoy p.${pageNum}`,
        reason: 'seção Palhetas de Caminhão (fora do segmento leve)',
        item: `Página inteira ${pageNum} de caminhões`,
      });
      continue;
    }

    let sectionFamily = 'Palhetas';
    if (pageNum >= 65 && pageNum <= 98) sectionFamily = 'Palhetas Dianteiras Específicas';
    else if (pageNum >= 99 && pageNum <= 140) sectionFamily = 'Palhetas Traseiras Específicas';
    else if (pageNum >= 141 && pageNum <= 160) sectionFamily = 'Palhetas Silicone';
    else if (pageNum >= 161 && pageNum <= 166) sectionFamily = 'Palhetas Traseiras com Braço';
    else if (pageNum >= 177 && pageNum <= 198) sectionFamily = 'Palhetas de Ferro';
    else if (pageNum >= 199 && pageNum <= 212) sectionFamily = 'Palhetas Híbridas';
    else if (pageNum >= 213 && pageNum <= 218) sectionFamily = 'Palhetas Dianteiras Multiencaixe';
    else if (pageNum >= 219 && pageNum <= 224) sectionFamily = 'Palhetas Traseiras Multiencaixe';
    else if (pageNum >= 225 && pageNum <= 227) sectionFamily = 'Palhetas Traseira Carenada';

    const pageSrc = getSource(pageNum, sectionFamily);

    // Detecta montadora da página (se houver cabeçalho de marca como "GENERAL MOTORS", "FORD", "VOLKSWAGEN")
    let pageBrand = '';
    const headerBrandSpans = page.spans.filter((s) => s.y0 < 130 && s.sz >= 14);
    for (const hb of headerBrandSpans) {
      const text = hb.t.trim();
      if (
        !text.toLowerCase().includes('palheta') &&
        !text.toLowerCase().includes('catálogo') &&
        !/\d/.test(text) &&
        text.length > 2
      ) {
        pageBrand = titleCase(text);
        break;
      }
    }

    // 1. Processamento das páginas específicas dianteiras (65-98)
    if (pageNum >= 65 && pageNum <= 98) {
      // Localiza todos os códigos do tipo YN-PS... ou YN-PR...
      const codeSpans = page.spans.filter((s) => /YN-P[SR][0-9A-Z]+/i.test(s.t.trim()));

      for (const cs of codeSpans) {
        const code = cs.t.trim().toUpperCase().replace(/\|$/, '').trim();
        // Área do bloco: em torno de cs.x0 e cs.y0
        // No layout Cinoy, há 2 colunas de blocos (esquerda x < 280, direita x >= 280) e 3 linhas Y
        const colXMin = cs.x0 < 280 ? 0 : 280;
        const colXMax = cs.x0 < 280 ? 280 : 600;
        const blockYMin = Math.max(0, cs.y0 - 20);
        const blockYMax = cs.y0 + 170;

        const blockSpans = page.spans.filter(
          (s) => s.x0 >= colXMin && s.x0 < colXMax && s.y0 >= blockYMin && s.y0 <= blockYMax,
        );

        // Encaixe
        let encaixe = '';
        const encIdx = blockSpans.findIndex((s) => s.t.includes('ENCAIXE') || s.t.includes('CONEXÃO'));
        if (encIdx !== -1) {
          // Próximo span após ENCAIXE
          for (let i = encIdx + 1; i < Math.min(encIdx + 4, blockSpans.length); i++) {
            const t = blockSpans[i]!.t.trim();
            if (/^[A-Z0-9]{1,3}$/i.test(t)) {
              encaixe = t.toUpperCase();
              break;
            }
          }
        }

        // Medidas: MOT. 24" PAX. 16"
        let motInches: number | null = null;
        let paxInches: number | null = null;
        for (let i = 0; i < blockSpans.length; i++) {
          const s = blockSpans[i]!;
          if (s.t.includes('MOT.')) {
            const next = blockSpans[i + 1]?.t ?? '';
            const next2 = blockSpans[i + 2]?.t ?? '';
            const m = `${s.t} ${next} ${next2}`.match(/(\d{1,2})[”"']/);
            if (m) motInches = Number(m[1]);
          }
          if (s.t.includes('PAX.')) {
            const next = blockSpans[i + 1]?.t ?? '';
            const next2 = blockSpans[i + 2]?.t ?? '';
            const m = `${s.t} ${next} ${next2}`.match(/(\d{1,2})[”"']/);
            if (m) paxInches = Number(m[1]);
          }
        }

        const connectorId = encaixe ? ensureConnector(encaixe, pageSrc) : undefined;

        // Cadastra produto
        const pId = stableId('prd', 'CINOY', code);
        const inchesArr = [motInches, paxInches].filter((n): n is number => n !== null);
        const mmArr = inchesArr.map((inc) => inchesToMillimeters(inc));

        if (!productsMap.has(compactCode(code))) {
          productsMap.set(compactCode(code), {
            id: pId,
            manufacturerId: mfrId,
            code,
            family: sectionFamily,
            packageType: 'par',
            inches: inchesArr,
            millimeters: mmArr,
            armCompatibility: encaixe ? [encaixe] : [],
            applicationScope: 'D',
            sourceIds: [pageSrc],
          });
        }

        // Modelos e Anos no bloco
        // Spans abaixo do cabeçalho do bloco antes das fotos
        const rowSpans = blockSpans.filter((s) => s.y0 > cs.y0 + 10 && s.y0 < cs.y0 + 80);
        const modelSpans = rowSpans.filter((s) => s.x0 < colXMin + 140);
        const yearSpans = rowSpans.filter((s) => s.x0 >= colXMin + 140 && s.x0 < colXMin + 230);

        for (let idx = 0; idx < Math.min(modelSpans.length, yearSpans.length); idx++) {
          const mText = modelSpans[idx]?.t.trim();
          const yText = yearSpans[idx]?.t.trim();
          if (!mText || !yText || mText === 'MODELO' || yText === 'ANO' || mText.length < 2) continue;

          const brand = pageBrand || inferBrandFromModel(mText) || 'Não informada';
          const exclusion = vehicleExclusionReason('passeio', brand, mText);
          if (exclusion) {
            excludedItems.push({ source: `Cinoy p.${pageNum}`, reason: exclusion, item: `${brand} ${mText}` });
            continue;
          }

          const yearRange = parseYearRange(yText, 2023);
          if (!yearRange.valid && yearRange.issue) {
            warnings.push(`Cinoy p.${pageNum}: ${brand} ${mText} - ${yearRange.issue}`);
          }
          const vKey = `${brand}|${mText}|${yText}`;
          let vehicle = vehiclesMap.get(vKey);
          if (!vehicle) {
            vehicle = {
              id: stableId('veh', 'CINOY', brand, mText, yText),
              manufacturerId: stableId('mfr', normalizeText(brand)),
              brand,
              model: mText,
              category: 'passeio',
              yearStart: yearRange.valid ? yearRange.yearStart : null,
              yearEnd: yearRange.valid ? yearRange.yearEnd : null,
              yearEndOpen: yearRange.valid ? yearRange.yearEndOpen : false,
              yearRaw: yText,
              sourceIds: [pageSrc],
            };
            vehiclesMap.set(vKey, vehicle);
          } else if (!vehicle.sourceIds.includes(pageSrc)) {
            vehicle.sourceIds.push(pageSrc);
          }

          // Cria aplicação Motorista e Passageiro
          if (motInches) {
            const appId = stableId('app', vehicle.id, 'motorista', code);
            const app: VehicleApplication = {
              id: appId,
              vehicleId: vehicle.id,
              position: 'motorista',
              inches: motInches,
              millimeters: inchesToMillimeters(motInches),
              sourceInches: motInches,
              sourceMillimeters: null,
              calculatedMillimeters: inchesToMillimeters(motInches),
              sizeLabel: `${motInches}"`,
              measureOrigin: 'application_table',
              connectorId,
              connectorRaw: encaixe || undefined,
              sourceIds: [pageSrc],
            };
            applications.push(app);

            fits.push({
              id: stableId('fit', appId, pId),
              vehicleApplicationId: appId,
              brandProductId: pId,
              relationType: 'catalog_documented',
              sourceIds: [pageSrc],
            });
          }

          if (paxInches) {
            const appId = stableId('app', vehicle.id, 'passageiro', code);
            const app: VehicleApplication = {
              id: appId,
              vehicleId: vehicle.id,
              position: 'passageiro',
              inches: paxInches,
              millimeters: inchesToMillimeters(paxInches),
              sourceInches: paxInches,
              sourceMillimeters: null,
              calculatedMillimeters: inchesToMillimeters(paxInches),
              sizeLabel: `${paxInches}"`,
              measureOrigin: 'application_table',
              connectorId,
              connectorRaw: encaixe || undefined,
              sourceIds: [pageSrc],
            };
            applications.push(app);

            fits.push({
              id: stableId('fit', appId, pId),
              vehicleApplicationId: appId,
              brandProductId: pId,
              relationType: 'catalog_documented',
              sourceIds: [pageSrc],
            });
          }
        }
      }
    }

    // 2. Processamento das outras seções (Traseiras específicas 99-140, Silicone 141-160, Híbridas 199-212, Carenada 225-227, Ferro 177-198)
    else {
      // Localiza código principal do bloco
      const codeMatches = page.spans.filter((s) => /YN-P[A-Z0-9]+/i.test(s.t.trim()));

      for (const cs of codeMatches) {
        const code = cs.t.trim().toUpperCase().replace(/\|$/, '').trim();
        const pId = stableId('prd', 'CINOY', code);

        // Conexão
        let encaixe = '';
        const encSpan = page.spans.find(
          (s) => Math.abs(s.y0 - cs.y0) < 15 && s.x0 > 450 && /^[A-Z0-9]{1,3}$/i.test(s.t.trim()),
        );
        if (encSpan) encaixe = encSpan.t.trim().toUpperCase();

        const connectorId = encaixe ? ensureConnector(encaixe, pageSrc) : undefined;

        // Polegadas no bloco
        const inchSpan = page.spans.find((s) => Math.abs(s.y0 - cs.y0) < 30 && /(\d{1,2})[”"']/.test(s.t));
        const foundInch = inchSpan ? parseInches(inchSpan.t) : null;

        if (!productsMap.has(compactCode(code))) {
          productsMap.set(compactCode(code), {
            id: pId,
            manufacturerId: mfrId,
            code,
            family: sectionFamily,
            packageType: sectionFamily.includes('Traseira') ? 'unitario' : 'unitario',
            inches: foundInch ? [foundInch] : [],
            millimeters: foundInch ? [inchesToMillimeters(foundInch)] : [],
            armCompatibility: encaixe ? [encaixe] : [],
            applicationScope: sectionFamily.includes('Traseira') ? 'T' : 'D',
            sourceIds: [pageSrc],
          });
        }

        // Tabela de modelos e anos
        // Identifica coluna (esquerda < 280, direita >= 280)
        const colXMin = cs.x0 < 280 ? 0 : 280;
        const colXMax = cs.x0 < 280 ? 280 : 600;
        const midX = colXMin + 140;

        // Procura linhas onde há modelos e anos estritamente dentro da coluna deste bloco
        const tableSpans = page.spans.filter((s) => s.x0 >= colXMin && s.x0 < colXMax && s.y0 > cs.y0 + 20 && s.y0 < cs.y0 + 220);
        const rows: Array<{ y: number; spans: typeof page.spans }> = [];
        for (const s of tableSpans) {
          let row = rows.find((r) => Math.abs(r.y - s.y0) <= 3);
          if (!row) {
            row = { y: s.y0, spans: [] };
            rows.push(row);
          }
          row.spans.push(s);
        }

        for (const r of rows) {
          const spans = [...r.spans].sort((a, b) => a.x0 - b.x0);
          const mSpan = spans.find((s) => s.x0 < midX && s.t.trim().length > 1 && !s.t.includes('MODELO') && !s.t.includes('CONEXÃO') && !/^YN-P/i.test(s.t.trim()));
          const ySpan = spans.find((s) => s.x0 >= midX && s.x0 < colXMax && isValidCatalogYear(s.t));
          if (!mSpan || !ySpan) continue;

          const modelText = mSpan.t.trim();
          const yearText = ySpan.t.trim();

          const brand = inferBrandFromModel(modelText) || pageBrand || 'Não informada';
          const exclusion = vehicleExclusionReason('passeio', brand, modelText);
          if (exclusion) {
            excludedItems.push({ source: `Cinoy p.${pageNum}`, reason: exclusion, item: `${brand} ${modelText}` });
            continue;
          }

          const yearRange = parseYearRange(yearText, 2023);
          if (!yearRange.valid && yearRange.issue) {
            warnings.push(`Cinoy p.${pageNum}: ${brand} ${modelText} - ${yearRange.issue}`);
          }
          const vKey = `${brand}|${modelText}|${yearText}`;
          let vehicle = vehiclesMap.get(vKey);
          if (!vehicle) {
            vehicle = {
              id: stableId('veh', 'CINOY', brand, modelText, yearText),
              manufacturerId: stableId('mfr', normalizeText(brand)),
              brand,
              model: modelText,
              category: 'passeio',
              yearStart: yearRange.valid ? yearRange.yearStart : null,
              yearEnd: yearRange.valid ? yearRange.yearEnd : null,
              yearEndOpen: yearRange.valid ? yearRange.yearEndOpen : false,
              yearRaw: yearText,
              sourceIds: [pageSrc],
            };
            vehiclesMap.set(vKey, vehicle);
          } else if (!vehicle.sourceIds.includes(pageSrc)) {
            vehicle.sourceIds.push(pageSrc);
          }

          const pos = sectionFamily.includes('Traseira') ? 'traseira' : 'par_dianteiro';
          const appId = stableId('app', vehicle.id, pos, code);
          const app: VehicleApplication = {
            id: appId,
            vehicleId: vehicle.id,
            position: pos,
            inches: foundInch,
            millimeters: foundInch ? inchesToMillimeters(foundInch) : null,
            sourceInches: foundInch,
            sourceMillimeters: null,
            calculatedMillimeters: foundInch ? inchesToMillimeters(foundInch) : null,
            sizeLabel: foundInch ? `${foundInch}"` : null,
            measureOrigin: foundInch ? 'application_table' : 'not_informed',
            connectorId,
            connectorRaw: encaixe || undefined,
            sourceIds: [pageSrc],
          };
          applications.push(app);

          fits.push({
            id: stableId('fit', appId, pId),
            vehicleApplicationId: appId,
            brandProductId: pId,
            relationType: 'catalog_documented',
            sourceIds: [pageSrc],
          });
        }
      }
    }
  }

  const importRecord: ImportRecord = {
    importId: stableId('imp', 'CINOY', 2023),
    source: raw.file,
    manufacturer: 'CINOY',
    catalogYear: 2023,
    importDate: new Date().toISOString(),
    status: warnings.length > 0 ? 'success_with_warnings' : 'success',
    recordCount: applications.length,
    errorCount: 0,
    warningCount: warnings.length,
    excludedCount: excludedItems.length,
  };

  return {
    manufacturer,
    catalog,
    sources: Array.from(sourcesMap.values()),
    connectors: Array.from(connectorsMap.values()),
    connectorEquivalences: [],
    vehicles: Array.from(vehiclesMap.values()),
    applications,
    products: Array.from(productsMap.values()),
    fits,
    importRecord,
    warnings,
    excludedItems,
  };
}
