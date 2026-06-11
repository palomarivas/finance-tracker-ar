import { convertUsdCentsToArsCents, pesosToCents } from './fx.util';

describe('fx.util', () => {
  describe('pesosToCents', () => {
    it('converts pesos to integer cents', () => {
      expect(pesosToCents(1050)).toBe(105000);
      expect(pesosToCents(1050.5)).toBe(105050);
    });

    it('rounds sub-cent values', () => {
      expect(pesosToCents(1234.567)).toBe(123457);
    });
  });

  describe('convertUsdCentsToArsCents', () => {
    it('values USD cents at the given ARS price per USD', () => {
      // USD 1,000.00 at 1,050.00 ARS/USD = ARS 1,050,000.00
      expect(convertUsdCentsToArsCents(100_000, 105_000)).toBe(105_000_000);
    });

    it('handles fractional results by rounding', () => {
      // USD 0.01 at 1,050.55 ARS/USD = ARS 10.5055 -> 1051 cents (rounded)
      expect(convertUsdCentsToArsCents(1, 105_055)).toBe(1051);
    });

    it('returns 0 for a zero amount', () => {
      expect(convertUsdCentsToArsCents(0, 105_000)).toBe(0);
    });
  });
});
