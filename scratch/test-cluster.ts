import { CatalogService } from '../src/services/catalog-service';
import type { CatalogDataset, Vehicle } from '../src/domain/types';
import { normalizeText } from '../src/domain/normalize';
import { canonicalizeManufacturer } from '../src/domain/manufacturers';
import { yearRangesOverlap } from '../src/domain/years';

function cleanVehicleModel(rawModel: string): string {
  let m = rawModel.toUpperCase();
  // Typos conhecidos
  m = m.replace(/\bHULUX\b/g, 'HILUX');
  m = m.replace(/\bGOLD\b/g, 'GOL');
  m = m.replace(/\bETIO\b/g, 'ETIOS');

  // Remove caracteres especiais residuais
  m = m.replace(/[*;]/g, ' ');

  // Normaliza gerações comuns (G1..G8 / I..VIII)
  m = m.replace(/\b(?:G\s*VI|GVI|G\s*6|G6|VI)\b/g, 'G6');
  m = m.replace(/\b(?:G\s*VII|GVII|G\s*7|G7|VII)\b/g, 'G7');
  m = m.replace(/\b(?:G\s*V|GV|G\s*5|G5|V)\b/g, 'G5');
  m = m.replace(/\b(?:G\s*IV|GIV|G\s*4|G4|IV)\b/g, 'G4');
  m = m.replace(/\b(?:G\s*III|GIII|G\s*3|G3|III)\b/g, 'G3');
  m = m.replace(/\b(?:G\s*II|GII|G\s*2|G2|II)\b/g, 'G2');
  m = m.replace(/\b(?:G\s*I|GI|G\s*1|G1|I)\b/g, 'G1');

  // Remove ruídos de motorização, combustível, válvulas e acabamentos
  m = m.replace(/\b\d\.\d(?:V)?\b/gi, ' ');
  m = m.replace(/\b(?:8V|16V|20V|24V|V6|V8|V10|V12|1000|MILLE)\b/gi, ' ');
  m = m.replace(/\b(?:TOTAL\s*FLEX|FLEXPOWER|TRI-FLEX|FLEX|TURBO|INTERCOOLER|BITURBO|DIESEL|GASOLINA|ETANOL|ALCOOL|GNV|HIBRIDO|HYBRID|ELETRICO|EV)\b/gi, ' ');
  m = m.replace(/\b(?:TSI|TFSI|MPI|THP|VTEC|I-VTEC|FIREFLY|FIRE|MI|POWER)\b/gi, ' ');
  m = m.replace(/\b(?:AUT\.|AUT|AUTOMATICO|MANUAL|CVT|DUALOGIC|I-MOTION|IMOTION|EASYTRONIC|4X4|4X2|AWD|4WD|4MATIC|QUATTRO)\b/gi, ' ');
  m = m.replace(/\b(?:CABINE\s*DUPLA|CABINE\s*SIMPLES|CABINE\s*ESTENDIDA|CABINE|2P|3P|4P|5P|2\s*PORTAS|4\s*PORTAS)\b/gi, ' ');
  m = m.replace(/\b(?:XEI|GLI|ALTIS|XLI|SE-G|XR|XLS|GR-S|LT|LTZ|PREMIER|JOY|ACTIV|ADVANTAGE|EFFECT|MIDNIGHT|CL|GL|GLS|GTI|GTS|GT|SPORT|SPORTING)\b/gi, ' ');
  m = m.replace(/\b(?:ATTRACTIVE|ESSENCE|DYNAMIC|EVO|CELEBRATION|WAY|ECONOMY|DRIVE|TREND|TRENDLINE|COMFORTLINE|HIGHLINE|TRACK|SPECIAL|TITANIUM|FREESTYLE|ST|SE|SEL)\b/gi, ' ');
  m = m.replace(/\b(?:FASE\s*[1-4]|QUADRADO|BOLINHA)\b/gi, ' ');
  m = m.replace(/\b(?:BX|LS|NOVO|NOVA)\b/gi, ' ');

  // Se tem barra ou parentese (ex: "Hilux/SW4" ou "Corolla/Wagon"), trata o base
  return normalizeText(m).trim();
}

function testClustering(vehicles: Vehicle[]) {
  const groups: Array<{ key: string; items: Vehicle[] }> = [];

  for (const v of vehicles) {
    const brand = normalizeText(canonicalizeManufacturer(v.brand) || v.brand);
    const cleaned = cleanVehicleModel(v.model);
    const cKey = `${brand}|${cleaned}`;

    const existing = groups.find((g) => {
      // Mesma montadora e modelo normalizado similar
      const sameBrand = g.key.split('|')[0] === brand;
      if (!sameBrand) return false;
      const gClean = g.key.split('|')[1];
      const modelMatch = gClean === cleaned || gClean.includes(cleaned) || cleaned.includes(gClean);
      return modelMatch && g.items.some((other) => yearRangesOverlap(v, other));
    });

    if (existing) {
      existing.items.push(v);
    } else {
      groups.push({ key: cKey, items: [v] });
    }
  }

  return groups;
}

async function run() {
  const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());

  for (const query of ['HILUX', 'COROLLA', 'GOL', 'PALIO', 'ONIX']) {
    const matchingVehicles = dataset.vehicles.filter((v) => {
      const q = query.toLowerCase();
      const m = v.model.toLowerCase();
      // Não confunde 'gol' com 'golf', 'hilux' com outro carro
      return m.split(/[\s\/\(\)]+/).some((w) => w.startsWith(q) || q.startsWith(w));
    });

    const groups = testClustering(matchingVehicles);
    console.log(`\n=================== MODELO: ${query} (De ${matchingVehicles.length} para ${groups.length} grupos) ===================`);
    groups.forEach((g, i) => {
      const years = g.items.map((x) => `${x.yearStart || '?'}-${x.yearEnd || '?'}`);
      const models = Array.from(new Set(g.items.map((x) => x.model)));
      console.log(`  #${i + 1} [Key: ${g.key}]: ${models.slice(0, 3).join(' / ')} (Total variantes unificadas: ${g.items.length})`);
    });
  }
}
run();
