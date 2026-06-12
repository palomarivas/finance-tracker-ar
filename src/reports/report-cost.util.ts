/**
 * Resolves a transaction's effective ARS cost from its frozen FX fields.
 *
 * For USD credit-card spend the peso cost was frozen at import time as
 * base (OFICIAL) + perception (TARJETA − OFICIAL). Which part counts depends
 * on how the resumen was settled:
 *   - paid in ARS  → base + perception (the surcharge stands)
 *   - paid in USD  → base only (perceptionReversed = true)
 *
 * Returns null when the row has no frozen valuation (callers convert those
 * with a live/historical rate instead).
 */
export function frozenArsCents(tx: {
  baseArsCents: number | null;
  perceptionArsCents: number | null;
  perceptionReversed: boolean;
}): number | null {
  if (tx.baseArsCents === null) {
    return null;
  }
  const perception = tx.perceptionReversed ? 0 : (tx.perceptionArsCents ?? 0);
  return tx.baseArsCents + perception;
}
