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
import { inchesToMillimeters, parseInches, parseInchesList, parseMillimetersList } from '@/domain/measures';
import { parseYearRange } from '@/domain/years';
import { vehicleExclusionReason } from '@/domain/vehicle-category';
import { compactCode, normalizeText, titleCase } from '@/domain/normalize';

export function parseDynaCatalog(raw: RawExtraction): ParseResult {
  const mfrId = stableId('mfr', 'DYNA');
  const catId = stableId('cat', 'DYNA', 2025);

  const manufacturer: Manufacturer = {
    id: mfrId,
    code: 'DYNA',
    name: 'Dyna',
    active: true,
    roles: ['wiper_blade'],
  };

  const catalog: Catalog = {
    id: catId,
    manufacturerId: mfrId,
    catalogName: 'Dyna Original',
    catalogYear: 2025,
    fileName: raw.file,
    sha256: raw.sha256,
    pageCount: raw.pageCount,
  };

  const sourcesMap = new Map<string, CatalogSource>();
  function getSource(page: number, section?: string): string {
    const sId = stableId('src', catId, page, section ?? 'default');
    if (!sourcesMap.has(sId)) {
      sourcesMap.set(sId, {
        id: sId,
        catalogId: catId,
        manufacturer: 'DYNA',
        catalogName: 'Dyna Original',
        catalogYear: 2025,
        page,
        section,
        sourceReference: `DYNA — Catálogo 2025 — Página ${page}`,
      });
    }
    return sId;
  }

  // 1. Conectores Dyna documentados (página 36)
  const connectorsMap = new Map<string, Connector>();
  const dynaConnectorsDef = [
    { code: 'G', name: 'Gancho', desc: 'Gancho tradicional' },
    { code: 'B', name: 'Baioneta', desc: 'Baioneta' },
    { code: 'DTL', name: 'Top-Lock Original Dyna', desc: 'Top-Lock Original Dyna' },
    { code: 'SL1', name: 'Side-Lock', desc: 'Side-Lock' },
    { code: 'TL1', name: 'Top-Lock 19mm', desc: 'Top-Lock 19mm' },
    { code: 'TL2', name: 'Top-Lock', desc: 'Top-Lock' },
    { code: 'TL3', name: 'Top-Lock 16mm', desc: 'Top-Lock 16mm (mesma família TL5)' },
    { code: 'TL5', name: 'Top-Lock 16mm', desc: 'Top-Lock 16mm' },
    { code: 'TL7', name: 'Top-Lock Baioneta', desc: 'Top-Lock Baioneta' },
    // Traseiras
    { code: '1', name: 'Conexão Traseira 1', desc: 'Engate traseiro tipo 1' },
    { code: '3', name: 'Conexão Traseira 3', desc: 'Engate traseiro tipo 3' },
    { code: '8', name: 'Conexão Traseira 8', desc: 'Engate traseiro tipo 8' },
    { code: 'D1', name: 'Conexão Traseira D1', desc: 'Engate traseiro D1' },
    { code: 'DL3', name: 'Conexão Traseira DL3', desc: 'Engate traseiro DL3' },
    { code: 'Dyna', name: 'Conexão Traseira Dyna', desc: 'Engate traseiro tipo Dyna' },
  ];

  const p36SourceId = getSource(36, 'Sistema de Conexões');
  for (const c of dynaConnectorsDef) {
    const cId = stableId('con', 'DYNA', c.code);
    connectorsMap.set(c.code, {
      id: cId,
      canonicalCode: `DYNA:${c.code}`,
      code: c.code,
      manufacturerId: mfrId,
      name: c.name,
      aliases: [c.code, `Dyna ${c.code}`],
      manufacturerMappings: { DYNA: [c.code] },
      description: c.desc,
      sourceIds: [p36SourceId],
    });
  }

  // 2. Produtos Dyna (páginas 37 a 39)
  const productsMap = new Map<string, BrandProduct>();

  function registerProduct(p: BrandProduct) {
    productsMap.set(compactCode(p.code), p);
  }

  for (const pageNum of [37, 38, 39]) {
    const page = raw.pages.find((p) => p.page === pageNum);
    if (!page) continue;

    const pageSrc = getSource(pageNum, 'Linha de Produtos');

    // Agrupar spans por linha Y
    const rows: Array<{ y: number; spans: typeof page.spans }> = [];
    for (const span of [...page.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
      if (span.y0 < 90) continue;
      let row = rows.find((r) => Math.abs(r.y - span.y0) <= 3.5);
      if (!row) {
        row = { y: span.y0, spans: [] };
        rows.push(row);
      }
      row.spans.push(span);
    }

    for (const r of rows) {
      const spans = [...r.spans].sort((a, b) => a.x0 - b.x0);
      const text = spans.map((s) => s.t.trim()).filter(Boolean).join(' ');
      if (!text || text.length < 3) continue;

      // Ignora rótulos intermediários ou cabeçalhos
      if (/^(CONVENCIONAL|SLIM|HÍBRIDA|TRASEIRA|DX|PESADA|AGRÍCOLA)/i.test(text) && !/\d/.test(text)) {
        continue;
      }

      // Descarta explicitamente se for linha pesada ou agrícola (página 38/39)
      if (pageNum === 38 && r.y > 700) continue; // PESADA (097 a 172)
      if (pageNum === 39 && r.y < 340) continue; // PESADA e AGRÍCOLA (174 a 192)

      // Identifica código inicial: ex: "S501", "SD1", "015", "DX15", "H614", "10E", "R12"
      const m = text.match(/^([A-Z0-9]+)\s+([DT](?:\/[DT])?)\s+([0-9/,\s]+)\s+([0-9",/\s”]+)\s+(Par|Peça)\s*(.*)$/i);
      if (!m) continue;

      const code = m[1]!.trim();
      const scope = m[2]!.trim().toUpperCase();
      const mmStr = m[3]!.trim();
      const inchStr = m[4]!.trim();
      const pkg = m[5]!.toLowerCase() === 'par' ? 'par' : 'unitario';
      const mainApps = m[6]!.trim();

      const inches = parseInchesList(inchStr) ?? (parseInches(inchStr) !== null ? [parseInches(inchStr)!] : []);
      const mm = parseMillimetersList(mmStr) ?? [];

      let family = 'Convencional';
      if (code.startsWith('S') && !code.startsWith('SD')) family = 'Slim Blade';
      else if (code.startsWith('SD')) family = 'Slim Blade Específica';
      else if (code.startsWith('DX')) family = 'DX';
      else if (code.startsWith('H')) family = 'Híbrida';
      else if (scope === 'T' || /^(046|053|055|[0-9]{2}[ES]|R[0-9]{2})$/.test(code)) family = 'Traseira';

      const pId = stableId('prd', 'DYNA', code);
      registerProduct({
        id: pId,
        manufacturerId: mfrId,
        code,
        family,
        packageType: pkg,
        inches,
        millimeters: mm,
        armCompatibility: [],
        applicationScope: scope,
        mainApplicationsText: mainApps || undefined,
        sourceIds: [pageSrc],
      });
    }
  }

  // 3. Aplicações Dyna (páginas 4 a 31)
  const vehiclesMap = new Map<string, Vehicle>();
  const applications: VehicleApplication[] = [];
  const fits: ProductFit[] = [];
  const excludedItems: Array<{ source: string; reason: string; item: string }> = [];
  const warnings: string[] = [];

  let currentBrand = '';

  for (let pageNum = 4; pageNum <= 31; pageNum++) {
    const page = raw.pages.find((p) => p.page === pageNum);
    if (!page) continue;

    const pageSrc = getSource(pageNum, 'Linha Leve: Automóveis e Utilitários');

    // Agrupar spans por linha Y com tolerância de 3.5px
    const rows: Array<{ y: number; spans: typeof page.spans }> = [];
    for (const span of [...page.spans].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
      if (span.y0 < 92) continue; // Cabeçalho da página
      let row = rows.find((r) => Math.abs(r.y - span.y0) <= 3.5);
      if (!row) {
        row = { y: span.y0, spans: [] };
        rows.push(row);
      }
      row.spans.push(span);
    }

    // Se estiver na página 31 e atingir a seção de caminhões, interrompe imediatamente!
    for (const r of rows) {
      if (pageNum === 31 && r.y >= 350) break;
      const spans = [...r.spans].sort((a, b) => a.x0 - b.x0);

      // Checa título de montadora (cor amarela cfac012 / 16433170 exclusiva dos cabeçalhos na margem esquerda)
      const brandSpan = spans.find(
        (s) => s.x0 < 80 && (s.c === 0xfac012 || s.c === 16433170) && !/\d/.test(s.t),
      );
      if (brandSpan && brandSpan.t.trim().length > 1) {
        const candidate = titleCase(brandSpan.t.trim());
        if (
          !candidate.toLowerCase().includes('linha') &&
          !candidate.toLowerCase().includes('catálogo') &&
          !candidate.toLowerCase().includes('caminhões')
        ) {
          currentBrand = candidate;
        }
      }

      // Linha de dados: tem modelo em x < 160 e ano em 160 <= x < 210
      const modelSpans = spans.filter((s) => s.x0 < 160 && s !== brandSpan);
      const yearSpans = spans.filter((s) => s.x0 >= 160 && s.x0 < 210);

      if (modelSpans.length === 0 || yearSpans.length === 0) continue;

      const modelRaw = modelSpans.map((s) => s.t.trim()).filter(Boolean).join(' ');
      const yearRaw = yearSpans.map((s) => s.t.trim()).filter(Boolean).join('');

      if (!modelRaw || !yearRaw || modelRaw.toLowerCase().includes('ano') || modelRaw.length < 2) {
        continue;
      }

      // Verificação de Linha Pesada (Filtro Obrigatório Fase 7)
      const exclusion = vehicleExclusionReason('passeio', currentBrand, modelRaw);
      if (exclusion) {
        excludedItems.push({
          source: `Dyna p.${pageNum}`,
          reason: exclusion,
          item: `${currentBrand} ${modelRaw}`,
        });
        continue;
      }

      const yearRange = parseYearRange(yearRaw, 2025);
      if (!yearRange.valid && yearRange.issue) {
        warnings.push(`Dyna p.${pageNum}: ${currentBrand} ${modelRaw} - ${yearRange.issue}`);
      }

      const vKey = `${currentBrand}|${modelRaw}|${yearRaw}`;
      let vehicle = vehiclesMap.get(vKey);
      if (!vehicle) {
        const vId = stableId('veh', 'DYNA', currentBrand, modelRaw, yearRaw);
        vehicle = {
          id: vId,
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

      // Extrai colunas da linha
      const connSpans = spans.filter((s) => s.x0 >= 210 && s.x0 < 240);
      const convSpans = spans.filter((s) => s.x0 >= 240 && s.x0 < 280);
      const dxSpans = spans.filter((s) => s.x0 >= 280 && s.x0 < 320);
      const slimParSpans = spans.filter((s) => s.x0 >= 320 && s.x0 < 350);
      const slimMotSpans = spans.filter((s) => s.x0 >= 350 && s.x0 < 380);
      const slimPaxSpans = spans.filter((s) => s.x0 >= 380 && s.x0 < 415);
      const hibMotSpans = spans.filter((s) => s.x0 >= 415 && s.x0 < 450);
      const hibPaxSpans = spans.filter((s) => s.x0 >= 450 && s.x0 < 490);
      const trasSpans = spans.filter((s) => s.x0 >= 490 && s.x0 < 530);
      const trasEngSpans = spans.filter((s) => s.x0 >= 530 && s.x0 < 580);

      const connRaw = connSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const convCode = convSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const dxCode = dxSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const slimParCode = slimParSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const slimMotCode = slimMotSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const slimPaxCode = slimPaxSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const hibMotCode = hibMotSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const hibPaxCode = hibPaxSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const trasCode = trasSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');
      const trasEng = trasEngSpans.map((s) => s.t.trim()).filter((t) => t && t !== '-').join('');

      const connectorId = connRaw ? connectorsMap.get(connRaw)?.id : undefined;

      // Helper para criar aplicação e fit correspondente
      function addApplicationAndFit(
        pos: 'motorista' | 'passageiro' | 'par_dianteiro' | 'traseira',
        productCode: string,
        posConnId?: string,
        posConnRaw?: string,
      ) {
        if (!productCode) return;
        const prod = productsMap.get(compactCode(productCode));

        let inches: number | null = null;
        let mm: number | null = null;
        let sizeLabel: string | null = null;

        if (prod && prod.inches.length > 0) {
          if (pos === 'par_dianteiro' && prod.inches.length > 1) {
            sizeLabel = `${prod.inches[0]}"/${prod.inches[1]}"`;
          } else {
            inches = prod.inches[0] ?? null;
            mm = prod.millimeters[0] ?? (inches ? inchesToMillimeters(inches) : null);
            sizeLabel = inches ? `${inches}"` : null;
          }
        }

        const appId = stableId('app', vehicle!.id, pos, productCode);
        const app: VehicleApplication = {
          id: appId,
          vehicleId: vehicle!.id,
          position: pos,
          inches,
          millimeters: mm,
          sourceInches: inches,
          sourceMillimeters: mm,
          calculatedMillimeters: inches && !mm ? inchesToMillimeters(inches) : null,
          sizeLabel,
          measureOrigin: prod ? 'product_table' : 'not_informed',
          connectorId: posConnId,
          connectorRaw: posConnRaw,
          sourceIds: [pageSrc],
        };
        applications.push(app);

        // Se o produto não estava na tabela 37-39, cadastra como produto catalogado
        let brandProd = prod;
        if (!brandProd) {
          const bpId = stableId('prd', 'DYNA', productCode);
          brandProd = {
            id: bpId,
            manufacturerId: mfrId,
            code: productCode,
            family: pos === 'traseira' ? 'Traseira' : 'Catálogo Aplicação',
            inches: [],
            millimeters: [],
            armCompatibility: posConnRaw ? [posConnRaw] : [],
            sourceIds: [pageSrc],
          };
          registerProduct(brandProd);
        }

        const fitId = stableId('fit', appId, brandProd.id);
        fits.push({
          id: fitId,
          vehicleApplicationId: appId,
          brandProductId: brandProd.id,
          relationType: 'catalog_documented',
          sourceIds: [pageSrc],
        });
      }

      // Par dianteiro Slim (ex.: SD6, S401)
      if (slimParCode) {
        addApplicationAndFit('par_dianteiro', slimParCode, connectorId, connRaw);
      }

      // Slim Motorista & Passageiro
      if (slimMotCode) {
        addApplicationAndFit('motorista', slimMotCode, connectorId, connRaw);
      }
      if (slimPaxCode) {
        addApplicationAndFit('passageiro', slimPaxCode, connectorId, connRaw);
      }

      // Convencional
      if (convCode) {
        addApplicationAndFit('par_dianteiro', convCode, connectorId, connRaw);
      }

      // DX
      if (dxCode) {
        addApplicationAndFit('par_dianteiro', dxCode, connectorId, connRaw);
      }

      // Híbrida Motorista & Passageiro
      if (hibMotCode) {
        addApplicationAndFit('motorista', hibMotCode, connectorId, connRaw);
      }
      if (hibPaxCode) {
        addApplicationAndFit('passageiro', hibPaxCode, connectorId, connRaw);
      }

      // Traseira
      if (trasCode) {
        const trasConnId = trasEng ? connectorsMap.get(trasEng)?.id : undefined;
        addApplicationAndFit('traseira', trasCode, trasConnId, trasEng);
      }
    }
  }

  const importRecord: ImportRecord = {
    importId: stableId('imp', 'DYNA', 2025),
    source: raw.file,
    manufacturer: 'DYNA',
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
