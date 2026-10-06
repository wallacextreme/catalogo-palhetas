import { normalizeText } from './normalize';

/**
 * Lista canônica e autoritativa de montadoras de veículos.
 * Estritamente fabricantes automotivos legítimos (sem medidas em polegadas e sem modelos de veículos).
 */
export const OFFICIAL_VEHICLE_MANUFACTURERS: string[] = [
  'Alfa Romeo',
  'Asia',
  'Audi',
  'BMW',
  'BYD',
  'Chery',
  'Chevrolet',
  'Chrysler',
  'Citroën',
  'Daewoo',
  'Daihatsu',
  'Dodge',
  'Effa',
  'Ferrari',
  'Fiat',
  'Ford',
  'Geely',
  'Gurgel',
  'GWM',
  'Honda',
  'Hyundai',
  'Iveco',
  'JAC',
  'Jaguar',
  'Jeep',
  'JPX',
  'Kia',
  'Lada',
  'Lamborghini',
  'Land Rover',
  'Lexus',
  'Lifan',
  'Mazda',
  'McLaren',
  'Mercedes-Benz',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Peugeot',
  'Porsche',
  'Puma Alfa',
  'RAM',
  'Renault',
  'Seat',
  'Seres',
  'Smart',
  'Ssangyong',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Troller',
  'Volkswagen',
  'Volvo',
];

const CANONICAL_MAP: Record<string, string> = {
  'alfa romeo': 'Alfa Romeo',
  'asia': 'Asia',
  'asia motors': 'Asia',
  'audi': 'Audi',
  'bmw': 'BMW',
  'byd': 'BYD',
  'chery': 'Chery',
  'caoa chery': 'Chery',
  'chevrolet': 'Chevrolet',
  'gm': 'Chevrolet',
  'gm chevrolet': 'Chevrolet',
  'gm/chevrolet': 'Chevrolet',
  'general motors': 'Chevrolet',
  'chrysler': 'Chrysler',
  'citroen': 'Citroën',
  'citroën': 'Citroën',
  'daewoo': 'Daewoo',
  'daihatsu': 'Daihatsu',
  'dodge': 'Dodge',
  'effa': 'Effa',
  'ferrari': 'Ferrari',
  'fiat': 'Fiat',
  'ford': 'Ford',
  'geely': 'Geely',
  'gurgel': 'Gurgel',
  'gwm': 'GWM',
  'honda': 'Honda',
  'hyundai': 'Hyundai',
  'iveco': 'Iveco',
  'jac': 'JAC',
  'jac motors': 'JAC',
  'jaguar': 'Jaguar',
  'jeep': 'Jeep',
  'jpx': 'JPX',
  'kia': 'Kia',
  'kia motors': 'Kia',
  'lada': 'Lada',
  'lamborghini': 'Lamborghini',
  'land rover': 'Land Rover',
  'lexus': 'Lexus',
  'lifan': 'Lifan',
  'mazda': 'Mazda',
  'mclaren': 'McLaren',
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'mini': 'Mini',
  'mitsubishi': 'Mitsubishi',
  'mitsubishi motors': 'Mitsubishi',
  'nissan': 'Nissan',
  'peugeot': 'Peugeot',
  'porsche': 'Porsche',
  'puma': 'Puma Alfa',
  'puma alfa': 'Puma Alfa',
  'ram': 'RAM',
  'renault': 'Renault',
  'seat': 'Seat',
  'seres': 'Seres',
  'smart': 'Smart',
  'ssangyong': 'Ssangyong',
  'subaru': 'Subaru',
  'suzuki': 'Suzuki',
  'tesla': 'Tesla',
  'toyota': 'Toyota',
  'troller': 'Troller',
  'volkswagen': 'Volkswagen',
  'vw': 'Volkswagen',
  'volvo': 'Volvo',
};

/**
 * Normaliza o nome de uma montadora para o nome oficial padronizado.
 * Retorna null se não for uma montadora automotiva válida (ex: medidas, modelos, "Não informada").
 */
export function canonicalizeManufacturer(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Se for medida ou tiver números/aspas, descarta
  if (/\d/.test(trimmed) || /["'”’]/.test(trimmed)) return null;

  const norm = normalizeText(trimmed);
  if (norm === 'nao informada' || norm === 'outros' || norm === '') return null;

  if (CANONICAL_MAP[norm]) {
    return CANONICAL_MAP[norm]!;
  }

  // Checa correspondência parcial com montadoras oficiais
  for (const m of OFFICIAL_VEHICLE_MANUFACTURERS) {
    if (normalizeText(m) === norm) return m;
  }

  return null;
}
