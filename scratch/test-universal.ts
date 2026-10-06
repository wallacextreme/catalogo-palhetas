import type { CatalogDataset, Vehicle } from '../src/domain/types';
import { normalizeText } from '../src/domain/normalize';
import { canonicalizeManufacturer } from '../src/domain/manufacturers';
import { yearRangesOverlap } from '../src/domain/years';

export function getCleanModelFamily(v: Vehicle): string {
  let m = v.model.toUpperCase();

  // Typos conhecidos de catálogos
  m = m.replace(/\bHULUX\b/g, 'HILUX');
  m = m.replace(/\bGOLD\b/g, 'GOL');
  m = m.replace(/\bETIO\b/g, 'ETIOS');

  // Mantém distinções fundamentais de carroceria/modelo antes de limpar
  const isSW4 = /\b(?:SW4|SW)\b/i.test(m);
  const isWeekend = /\bWEEKEND\b/i.test(m);
  const isAdventure = /\bADVENTURE\b/i.test(m);
  const isCross = /\bCROSS\b/i.test(m) && !m.includes('CROSSFOX');
  const isFielder = /\bFIELDER\b/i.test(m);

  // Normaliza notação de gerações (G1..G8 / I..VIII)
  m = m.replace(/\b(?:G\s*VI|GVI|G\s*6|G6|VI)\b/g, ' G6 ');
  m = m.replace(/\b(?:G\s*VII|GVII|G\s*7|G7|VII)\b/g, ' G7 ');
  m = m.replace(/\b(?:G\s*V|GV|G\s*5|G5|V)\b/g, ' G5 ');
  m = m.replace(/\b(?:G\s*IV|GIV|G\s*4|G4|IV)\b/g, ' G4 ');
  m = m.replace(/\b(?:G\s*III|GIII|G\s*3|G3|III)\b/g, ' G3 ');
  m = m.replace(/\b(?:G\s*II|GII|G\s*2|G2|II)\b/g, ' G2 ');
  m = m.replace(/\b(?:G\s*I|GI|G\s*1|G1|I)\b/g, ' G1 ');

  // Remove caracteres especiais
  m = m.replace(/[*;,]/g, ' ');

  // Remove motorizações, cilindradas e válvulas
  m = m.replace(/\b\d\.\d(?:V)?\b/gi, ' ');
  m = m.replace(/\b(?:8V|16V|20V|24V|V6|V8|V10|V12|1000|MILLE)\b/gi, ' ');

  // Remove combustíveis e tecnologias de motor
  m = m.replace(/\b(?:TOTAL\s*FLEX|FLEXPOWER|TRI-FLEX|FLEX|TURBO|INTERCOOLER|BITURBO|DIESEL|GASOLINA|ETANOL|ALCOOL|GNV|HIBRIDO|HYBRID|ELETRICO|EV)\b/gi, ' ');
  m = m.replace(/\b(?:TSI|TFSI|MPI|THP|VTEC|I-VTEC|FIREFLY|FIRE|MI|POWER)\b/gi, ' ');

  // Remove transmissões e trações
  m = m.replace(/\b(?:AUT\.|AUT|AUTOMATICO|MANUAL|CVT|DUALOGIC|I-MOTION|IMOTION|EASYTRONIC|4X4|4X2|AWD|4WD|4MATIC|QUATTRO)\b/gi, ' ');

  // Remove cabine, portas e carrocerias que usam a mesma palheta
  m = m.replace(/\b(?:CABINE\s*DUPLA|CABINE\s*SIMPLES|CABINE\s*ESTENDIDA|CABINE|2P|3P|4P|5P|2\s*PORTAS|4\s*PORTAS)\b/gi, ' ');
  m = m.replace(/\b(?:SEDAN|HATCH|HATCHBACK|COUPE|PERUA|WAGON)\b/gi, ' ');

  // Remove acabamentos, séries e versões
  m = m.replace(/\b(?:XEI|GLI|ALTIS|XLI|SE-G|XR|XLS|GR-S|LT|LTZ|PREMIER|JOY|ACTIV|ADVANTAGE|EFFECT|MIDNIGHT)\b/gi, ' ');
  m = m.replace(/\b(?:CL|GL|GLS|GTI|GTS|GT|SPORT|SPORTING|R\/T|SS)\b/gi, ' ');
  m = m.replace(/\b(?:ATTRACTIVE|ESSENCE|DYNAMIC|EVO|CELEBRATION|WAY|ECONOMY|DRIVE|TREND|TRENDLINE|COMFORTLINE|HIGHLINE|TRACK|SPECIAL|TITANIUM|FREESTYLE|ST|SE|SEL)\b/gi, ' ');
  m = m.replace(/\b(?:FASE\s*[1-4]|QUADRADO|BOLINHA|NOVO|NOVA|SERIE|SÉRIE|GERACAO|GERAÇÃO)\b/gi, ' ');
  m = m.replace(/\b(?:BX|LS|CL|SL\/E|ALL)\b/gi, ' ');

  // Pega a primeira palavra ou palavras-chave principais antes de barras ou parênteses
  let primary = m.split('/')[0]?.split('(')[0]?.trim() || m;
  let normalized = normalizeText(primary).replace(/\s+/g, ' ').trim();

  // Restaura sufixos distintos essenciais de modelo
  if (isSW4 && !normalized.includes('sw4')) normalized = `${normalized} sw4`.trim();
  if (isWeekend && !normalized.includes('weekend')) normalized = `${normalized} weekend`.trim();
  if (isAdventure && !normalized.includes('adventure')) normalized = `${normalized} adventure`.trim();
  if (isCross && !normalized.includes('cross')) normalized = `${normalized} cross`.trim();
  if (isFielder && !normalized.includes('fielder')) normalized = `${normalized} fielder`.trim();

  return normalized;
}

async function testAll() {
  const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());

  const queries = ['HILUX', 'COROLLA', 'GOL', 'PALIO', 'ONIX', 'CIVIC', 'HB20'];

  for (const q of queries) {
    const list = dataset.vehicles.filter((v) => {
      // Model matching estrito para evitar falsos positivos
      const normModel = normalizeText(v.model);
      const normQ = normalizeText(q);
      const words = normModel.split(' ');
      // Não confunde 'gol' com 'golf', 'hilux' com outros
      return words.some((w) => w === normQ || (w.startsWith(normQ) && normQ.length >= 4));
    });

    // Agrupa usando getCleanModelFamily e overlap de anos
    const groups: Array<{ key: string; items: Vehicle[] }> = [];

    for (const v of list) {
      const brand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
      const family = getCleanModelFamily(v);
      const cKey = `${brand}|${family}`;

      const existing = groups.find((g) => {
        const sameBrand = g.key.split('|')[0] === brand;
        if (!sameBrand) return false;
        const gFam = g.key.split('|')[1];
        // Mesmo modelo ou submodelo sobreposto
        const familyMatch = gFam === family || 
          (gFam.startsWith(family) && !gFam.includes('sw4') && !family.includes('sw4')) ||
          (family.startsWith(gFam) && !gFam.includes('sw4') && !family.includes('sw4'));
        return familyMatch && g.items.some((other) => yearRangesOverlap(v, other));
      });

      if (existing) {
        existing.items.push(v);
      } else {
        groups.push({ key: cKey, items: [v] });
      }
    }

    console.log(`\n=== BUSCA: ${q} ===`);
    console.log(`Total registros brutos: ${list.length} => Quadros consolidados: ${groups.length}`);
    groups.forEach((g, i) => {
      const years = g.items.map((x) => `${x.yearStart ?? '?'}-${x.yearEnd ?? '?'}`);
      const minStart = Math.min(...g.items.map((v) => v.yearStart || 9999).filter((y) => y !== 9999));
      const maxEnds = g.items.map((v) => v.yearEnd).filter((y): y is number => y !== null);
      const hasOpen = g.items.some((v) => v.yearEndOpen || v.yearEnd === null);
      const maxEnd = maxEnds.length > 0 ? Math.max(...maxEnds) : null;
      const displayYears = minStart !== 9999 ? (hasOpen ? `${minStart} em diante` : `${minStart} → ${maxEnd}`) : 'Variado';

      const models = Array.from(new Set(g.items.map((x) => x.model)));
      console.log(`  #${i + 1}: [${g.key}] Ano: ${displayYears} (${g.items.length} variantes mescladas: ${models.slice(0, 3).join(', ')}${models.length > 3 ? '...' : ''})`);
    });
  }
}

testAll();
