import { describe, expect, it } from 'bun:test';
import { compactCode, normalizeText, tokenize, titleCase } from '@/domain/normalize';
import { inchesToMillimeters, isPlausibleBladeInches, parseInches, parseInchesList, parseMillimetersList } from '@/domain/measures';
import { parseYearRange, yearRangesOverlap, yearInRange } from '@/domain/years';
import { isAllowedVehicleCategory, detectHeavyLine, vehicleExclusionReason } from '@/domain/vehicle-category';
import { stableId } from '@/domain/ids';

describe('Domain: Text Normalization', () => {
  it('normalizes accents, spaces, and punctuation', () => {
    expect(normalizeText('São Paulo / SP - 2024')).toBe('sao paulo sp 2024');
    expect(compactCode('YN-PS2416B')).toBe('ynps2416b');
    expect(tokenize('Chevrolet Onix 2019')).toEqual(['chevrolet', 'onix', '2019']);
    expect(titleCase('GENERAL MOTORS')).toBe('General Motors');
  });
});

describe('Domain: Measures', () => {
  it('converts inches to millimeters precisely', () => {
    expect(inchesToMillimeters(24)).toBe(609.6);
    expect(inchesToMillimeters(16)).toBe(406.4);
    expect(inchesToMillimeters(10.5)).toBe(266.7);
  });

  it('validates plausible automotive wiper sizes', () => {
    expect(isPlausibleBladeInches(24)).toBe(true);
    expect(isPlausibleBladeInches(10)).toBe(true);
    expect(isPlausibleBladeInches(40)).toBe(false); // Linha pesada / fora de escopo
    expect(isPlausibleBladeInches(5)).toBe(false);
  });

  it('parses formatted inches', () => {
    expect(parseInches('24"')).toBe(24);
    expect(parseInches('10,5”')).toBe(10.5);
    expect(parseInches('invalido')).toBeNull();
    expect(parseInchesList('24"/14"')).toEqual([24, 14]);
    expect(parseMillimetersList('600/350')).toEqual([600, 350]);
  });
});

describe('Domain: Years Parsing', () => {
  it('parses various catalog year formats', () => {
    const r1 = parseYearRange('10 / 12', 2025);
    expect(r1.valid).toBe(true);
    expect(r1.yearStart).toBe(2010);
    expect(r1.yearEnd).toBe(2012);
    expect(r1.yearEndOpen).toBe(false);

    const r2 = parseYearRange('19 / -', 2025);
    expect(r2.valid).toBe(true);
    expect(r2.yearStart).toBe(2019);
    expect(r2.yearEnd).toBeNull();
    expect(r2.yearEndOpen).toBe(true);

    const r3 = parseYearRange('2019>', 2023);
    expect(r3.valid).toBe(true);
    expect(r3.yearStart).toBe(2019);
    expect(r3.yearEndOpen).toBe(true);

    const r4 = parseYearRange('****', 2023);
    expect(r4.valid).toBe(true);
    expect(r4.yearStart).toBeNull();

    // Inválido nunca deve ser corrigido silenciosamente
    const rErr = parseYearRange('19911/2000', 2023);
    expect(rErr.valid).toBe(false);
  });

  it('determines year overlaps accurately', () => {
    const rangeA = { yearStart: 2012, yearEnd: 2019, yearEndOpen: false };
    const rangeB = { yearStart: 2015, yearEnd: 2022, yearEndOpen: false };
    const rangeC = { yearStart: 2020, yearEnd: null, yearEndOpen: true };

    expect(yearRangesOverlap(rangeA, rangeB)).toBe(true);
    expect(yearRangesOverlap(rangeA, rangeC)).toBe(false);
    expect(yearInRange(2015, rangeA)).toBe(true);
    expect(yearInRange(2021, rangeA)).toBe(false);
  });
});

describe('Domain: Heavy Line Exclusion', () => {
  it('identifies allowed vehicle categories', () => {
    expect(isAllowedVehicleCategory('passeio')).toBe(true);
    expect(isAllowedVehicleCategory('utilitario_leve')).toBe(true);
    expect(isAllowedVehicleCategory('caminhao' as any)).toBe(false);
  });

  it('detects heavy line keywords even if catalog misclassifies', () => {
    expect(detectHeavyLine('Caminhão VW 8.150').heavy).toBe(true);
    expect(detectHeavyLine('Trator Massey Ferguson 4292').heavy).toBe(true);
    expect(detectHeavyLine('Colheitadeira TC5070').heavy).toBe(true);
    expect(detectHeavyLine('Ônibus Paradiso 1200').heavy).toBe(true);
    expect(detectHeavyLine('Fiat Strada 1.4').heavy).toBe(false);
    expect(detectHeavyLine('Chevrolet Tracker').heavy).toBe(false);
  });

  it('produces exclusion reasons correctly', () => {
    expect(vehicleExclusionReason('caminhao' as any, 'VW Constellation')).toContain('seção fora do segmento leve');
    expect(vehicleExclusionReason('passeio', 'Escavadeira 320D')).toContain('termo de linha pesada');
    expect(vehicleExclusionReason('passeio', 'Volkswagen Polo')).toBeNull();
  });
});

describe('Domain: Stable IDs', () => {
  it('generates deterministic IDs from components', () => {
    const id1 = stableId('veh', 'CHEVROLET', 'Onix', 2019);
    const id2 = stableId('veh', 'CHEVROLET', 'Onix', 2019);
    const id3 = stableId('veh', 'CHEVROLET', 'Onix', 2020);

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.startsWith('veh_')).toBe(true);
  });
});
