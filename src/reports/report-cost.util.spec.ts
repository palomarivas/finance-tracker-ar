import { frozenArsCents } from './report-cost.util';

describe('frozenArsCents', () => {
  it('charges base + perception when the resumen was paid in pesos', () => {
    expect(
      frozenArsCents({
        baseArsCents: -2820000,
        perceptionArsCents: -846000,
        perceptionReversed: false,
      }),
    ).toBe(-3666000);
  });

  it('charges base only after a USD payment reversed the perception', () => {
    expect(
      frozenArsCents({
        baseArsCents: -2820000,
        perceptionArsCents: -846000,
        perceptionReversed: true,
      }),
    ).toBe(-2820000);
  });

  it('returns null when nothing was frozen (caller converts live)', () => {
    expect(
      frozenArsCents({
        baseArsCents: null,
        perceptionArsCents: null,
        perceptionReversed: false,
      }),
    ).toBeNull();
  });
});
