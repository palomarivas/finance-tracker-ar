import {
  arAmountToCents,
  arDateToDate,
  normalizeDescription,
} from './parse-ar.util';

describe('parse-ar.util', () => {
  describe('arAmountToCents', () => {
    it('parses Argentine-formatted amounts', () => {
      expect(arAmountToCents('$ 1.054.628,11')).toBe(105462811);
      expect(arAmountToCents('$ 13.200,00')).toBe(1320000);
      expect(arAmountToCents('$ 0,24')).toBe(24);
    });

    it('parses negatives (leading sign and trailing sign)', () => {
      expect(arAmountToCents('$ -13.200,00')).toBe(-1320000);
      expect(arAmountToCents('550.000,00-')).toBe(-55000000);
    });

    it('parses USD notations', () => {
      expect(arAmountToCents('U$S 100,00')).toBe(10000);
      expect(arAmountToCents('-U$S 100,00')).toBe(-10000);
    });

    it('returns null for non-amounts', () => {
      expect(arAmountToCents('')).toBeNull();
      expect(arAmountToCents('Saldo Inicial')).toBeNull();
    });
  });

  describe('arDateToDate', () => {
    it('parses DD-MM-YYYY and DD/MM/YY', () => {
      expect(arDateToDate('01-05-2026')?.toISOString()).toBe(
        '2026-05-01T12:00:00.000Z',
      );
      expect(arDateToDate('28/05/26')?.toISOString()).toBe(
        '2026-05-28T12:00:00.000Z',
      );
    });

    it('rejects invalid dates', () => {
      expect(arDateToDate('2026-05-01')).toBeNull(); // ISO is not AR format
      expect(arDateToDate('45-99-2026')).toBeNull();
      expect(arDateToDate('Rendimientos')).toBeNull();
    });
  });

  describe('normalizeDescription', () => {
    it('lowercases and collapses whitespace', () => {
      expect(normalizeDescription('  Pago   SUBE \n Viajes ')).toBe(
        'pago sube viajes',
      );
    });
  });
});
