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
import { inchesToMillimeters } from '@/domain/measures';
import { parseYearRange } from '@/domain/years';
import { vehicleExclusionReason } from '@/domain/vehicle-category';
import { compactCode, normalizeText, titleCase } from '@/domain/normalize';

export function parseVetorCatalog(raw: RawExtraction): ParseResult {
  const mfrId = stableId('mfr', 'VETOR');
  const catId = stableId('cat', 'VETOR', 2025);

  const manufacturer: Manufacturer = {
    id: mfrId,
    code: 'VETOR',
    name: 'Vetor',
    active: true,
    roles: ['wiper_blade'],
  };

  const catalog: Catalog = {
    id: catId,
    manufacturerId: mfrId,
    catalogName: 'Catálogo de Palhetas',
    catalogYear: 2025,
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
        manufacturer: 'VETOR',
        catalogName: 'Catálogo de Palhetas',
        catalogYear: 2025,
        page,
        section,
        sourceReference: `VETOR — Catálogo 2025 — Página ${page}`,
      });
    }
    return sId;
  }

  // Conectores Vetor (documentados no sumário e páginas 61-63)
  const connectorsMap = new Map<string, Connector>();
  function ensureConnector(code: string, sourceId: string): string {
    const cleanCode = code.toUpperCase().trim();
    if (!connectorsMap.has(cleanCode)) {
      const cId = stableId('con', 'VETOR', cleanCode);
      connectorsMap.set(cleanCode, {
        id: cId,
        canonicalCode: `VETOR:${cleanCode}`,
        code: cleanCode,
        manufacturerId: mfrId,
        name: `Conexão Vetor ${cleanCode}`,
        aliases: [cleanCode, `Vetor Conexão ${cleanCode}`],
        manufacturerMappings: { VETOR: [cleanCode] },
        sourceIds: [sourceId],
      });
    }
    return connectorsMap.get(cleanCode)!.id;
  }

  const productsMap = new Map<string, BrandProduct>();
  function ensureProduct(code: string, family: string, scope: 'D' | 'T', sourceId: string): BrandProduct {
    const target = compactCode(code);
    let p = productsMap.get(target);
    if (!p) {
      // Infere polegadas do código do produto Vetor se documentado pelo prefixo numérico padrão (ex: PVT21 -> 21", PVF19 -> 19", PVM24 -> 24")
      const m = code.match(/PV[TFM](\d{2})/i);
      const inc = m ? Number(m[1]) : null;
      const inches = inc && inc >= 8 && inc <= 32 ? [inc] : [];
      const mm = inches.map((i) => inchesToMillimeters(i));

      p = {
        id: stableId('prd', 'VETOR', code),
        manufacturerId: mfrId,
        code,
        family,
        inches,
        millimeters: mm,
        armCompatibility: [],
        applicationScope: scope,
        sourceIds: [sourceId],
      };
      productsMap.set(target, p);
    } else if (!p.sourceIds.includes(sourceId)) {
      p.sourceIds.push(sourceId);
    }
    return p;
  }

  const vehiclesMap = new Map<string, Vehicle>();
  const applications: VehicleApplication[] = [];
  const fits: ProductFit[] = [];
  const excludedItems: Array<{ source: string; reason: string; item: string }> = [];
  const warnings: string[] = [];

  let currentBrand = '';

  for (const page of raw.pages) {
    const pageNum = page.page;

    // Linha pesada Vetor: páginas 33 a 46 (Agrícola, Máquinas, Ônibus, Caminhões)
    if (pageNum >= 33 && pageNum <= 46) {
      excludedItems.push({
        source: `Vetor p.${pageNum}`,
        reason: 'seção Linha Pesada / Máquinas Agrícolas / Caminhão / Ônibus',
        item: `Página ${pageNum}`,
      });
      continue;
    }

    // Eletrobombas Vetor: páginas 48 a 60
    if (pageNum >= 48 && pageNum <= 60) {
      excludedItems.push({
        source: `Vetor p.${pageNum}`,
        reason: 'seção Eletrobombas (fora de escopo de palhetas)',
        item: `Página ${pageNum}`,
      });
      continue;
    }

    // Apenas páginas de aplicação de automóvel e utilitários leves: 6 a 32
    if (pageNum < 6 || pageNum > 32) continue;

    const section = pageNum <= 26 ? 'Aplicação em Automóvel' : 'Aplicação em Utilitário Leve / Vans';
    const pageSrc = getSource(pageNum, section);

    // Agrupar spans por linha Y
    const rows: Array<{ y: number; spans: typeof page.spans }> = [];
    for (const span of [...page.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
      if (span.y0 < 80) continue;
      let row = rows.find((r) => Math.abs(r.y - span.y0) <= 2.5);
      if (!row) {
        row = { y: span.y0, spans: [] };
        rows.push(row);
      }
      row.spans.push(span);
    }

    const xOffset = pageNum % 2 === 1 ? 42.5 : 0;

    for (const r of rows) {
      const spans = [...r.spans].sort((a, b) => a.x0 - b.x0);

      // Detecta cabeçalho de marca em Vetor:
      // Título de montadora é SEMPRE texto em branco (0xffffff = 16777215), tamanho >= 10, fonte Bold
      const brandSpan = spans.find(
        (s) =>
          s.c === 16777215 &&
          s.sz >= 10 &&
          s.f.includes('Bold') &&
          !/\d/.test(s.t) &&
          !s.t.toLowerCase().includes('vetorauto') &&
          !s.t.toLowerCase().includes('carro') &&
          s.t.trim().length > 2,
      );
      if (brandSpan) {
        currentBrand = titleCase(brandSpan.t.trim());
        continue;
      }

      // Linha de dados: Modelo em x < 80 + xOffset e Ano em 80 + xOffset <= x < 120 + xOffset
      const modelSpan = spans.find((s) => s.x0 < 80 + xOffset && s.t.trim().length > 0 && !s.t.includes('CARRO'));
      const yearSpan = spans.find((s) => s.x0 >= 80 + xOffset && s.x0 < 120 + xOffset && /\d/.test(s.t));

      if (!modelSpan || !yearSpan) continue;

      const modelRaw = modelSpan.t.trim();
      const yearRaw = yearSpan.t.trim();

      const exclusion = vehicleExclusionReason('passeio', currentBrand, modelRaw);
      if (exclusion) {
        excludedItems.push({ source: `Vetor p.${pageNum}`, reason: exclusion, item: `${currentBrand} ${modelRaw}` });
        continue;
      }

      const yearRange = parseYearRange(yearRaw, 2025);
      if (!yearRange.valid && yearRange.issue) {
        warnings.push(`Vetor p.${pageNum}: ${currentBrand} ${modelRaw} - ${yearRange.issue}`);
      }
      const vKey = `${currentBrand}|${modelRaw}|${yearRaw}`;
      let vehicle = vehiclesMap.get(vKey);
      if (!vehicle) {
        vehicle = {
          id: stableId('veh', 'VETOR', currentBrand, modelRaw, yearRaw),
          manufacturerId: stableId('mfr', normalizeText(currentBrand)),
          brand: currentBrand || 'Não informada',
          model: modelRaw,
          category: 'passeio',
          yearStart: yearRange.valid ? yearRange.yearStart : null,
          yearEnd: yearRange.valid ? yearRange.yearEnd : null,
          yearEndOpen: yearRange.valid ? yearRange.yearEndOpen : false,
          yearRaw,
          sourceIds: [pageSrc],
        };
        vehiclesMap.set(vKey, vehicle);
      } else if (!vehicle.sourceIds.includes(pageSrc)) {
        vehicle.sourceIds.push(pageSrc);
      }

      // Extrai colunas da linha com xOffset
      const topMot = spans.find((s) => s.x0 >= 115 + xOffset && s.x0 < 155 + xOffset && /PVT\d+/i.test(s.t))?.t.trim();
      const topPax = spans.find((s) => s.x0 >= 155 + xOffset && s.x0 < 185 + xOffset && /PVT\d+/i.test(s.t))?.t.trim();
      const topEsp = spans.find((s) => s.x0 >= 185 + xOffset && s.x0 < 225 + xOffset && /PVT\d+/i.test(s.t))?.t.trim();
      const topTras = spans.find((s) => s.x0 >= 225 + xOffset && s.x0 < 260 + xOffset && /PVT\d+/i.test(s.t))?.t.trim();

      const flexMot = spans.find((s) => s.x0 >= 260 + xOffset && s.x0 < 300 + xOffset && /PVF\d+/i.test(s.t))?.t.trim();
      const flexPax = spans.find((s) => s.x0 >= 300 + xOffset && s.x0 < 335 + xOffset && /PVF\d+/i.test(s.t))?.t.trim();
      const flexEsp = spans.find((s) => s.x0 >= 335 + xOffset && s.x0 < 370 + xOffset && /PVF\d+/i.test(s.t))?.t.trim();
      const flexTras = spans.find((s) => s.x0 >= 370 + xOffset && s.x0 < 405 + xOffset && /PVF\d+/i.test(s.t))?.t.trim();

      const multiMot = spans.find((s) => s.x0 >= 405 + xOffset && s.x0 < 445 + xOffset && /PVM\d+/i.test(s.t))?.t.trim();
      const multiPax = spans.find((s) => s.x0 >= 445 + xOffset && s.x0 < 485 + xOffset && /PVM\d+/i.test(s.t))?.t.trim();

      const connDiant = spans.find((s) => s.x0 >= 485 + xOffset && s.x0 < 515 + xOffset && /^[A-Z0-9]{1,2}$/i.test(s.t))?.t.trim();
      const connTras = spans.find((s) => s.x0 >= 515 + xOffset && s.x0 < 555 + xOffset && /^[A-Z0-9]{1,2}$/i.test(s.t))?.t.trim();

      const connDiantId = connDiant ? ensureConnector(connDiant, pageSrc) : undefined;
      const connTrasId = connTras ? ensureConnector(connTras, pageSrc) : undefined;

      function addVetorFit(
        pos: 'motorista' | 'passageiro' | 'par_dianteiro' | 'traseira',
        code: string,
        family: string,
        scope: 'D' | 'T',
        cId?: string,
        cRaw?: string,
      ) {
        const prod = ensureProduct(code, family, scope, pageSrc);
        const appId = stableId('app', vehicle!.id, pos, code);

        const inc = prod.inches[0] ?? null;
        const mm = prod.millimeters[0] ?? (inc ? inchesToMillimeters(inc) : null);

        const app: VehicleApplication = {
          id: appId,
          vehicleId: vehicle!.id,
          position: pos,
          inches: inc,
          millimeters: mm,
          sourceInches: inc,
          sourceMillimeters: mm,
          calculatedMillimeters: inc && !mm ? inchesToMillimeters(inc) : null,
          sizeLabel: inc ? `${inc}"` : null,
          measureOrigin: inc ? 'application_table' : 'not_informed',
          connectorId: cId,
          connectorRaw: cRaw,
          sourceIds: [pageSrc],
        };
        applications.push(app);

        fits.push({
          id: stableId('fit', appId, prod.id),
          vehicleApplicationId: appId,
          brandProductId: prod.id,
          relationType: 'catalog_documented',
          sourceIds: [pageSrc],
        });
      }

      if (topMot) addVetorFit('motorista', topMot, 'Top Line', 'D', connDiantId, connDiant);
      if (topPax) addVetorFit('passageiro', topPax, 'Top Line', 'D', connDiantId, connDiant);
      if (topEsp) addVetorFit('par_dianteiro', topEsp, 'Top Line Específica', 'D', connDiantId, connDiant);
      if (topTras) addVetorFit('traseira', topTras, 'Top Line Traseira', 'T', connTrasId, connTras);

      if (flexMot) addVetorFit('motorista', flexMot, 'Flex', 'D', connDiantId, connDiant);
      if (flexPax) addVetorFit('passageiro', flexPax, 'Flex', 'D', connDiantId, connDiant);
      if (flexEsp) addVetorFit('par_dianteiro', flexEsp, 'Flex Específica', 'D', connDiantId, connDiant);
      if (flexTras) addVetorFit('traseira', flexTras, 'Flex Traseira', 'T', connTrasId, connTras);

      if (multiMot) addVetorFit('motorista', multiMot, 'MultiFix', 'D', connDiantId, connDiant);
      if (multiPax) addVetorFit('passageiro', multiPax, 'MultiFix', 'D', connDiantId, connDiant);
    }
  }

  const importRecord: ImportRecord = {
    importId: stableId('imp', 'VETOR', 2025),
    source: raw.file,
    manufacturer: 'VETOR',
    catalogYear: 2025,
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
