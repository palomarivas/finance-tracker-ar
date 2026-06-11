/**
 * Pure FX math, kept separate from I/O so it can be unit-tested in isolation.
 * Everything is integer cents; pesos floats from the APIs are converted on entry.
 */

/** "1050.5" pesos -> 105050 cents. */
export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

/**
 * Convert an amount in USD cents to ARS cents given the price of 1 USD in ARS
 * cents. e.g. 1_000_00 USD-cents at 1_050_00 ARS-cents/USD -> 1_050_000_00 ARS-cents.
 */
export function convertUsdCentsToArsCents(
  usdCents: number,
  pricePerUsdCents: number,
): number {
  return Math.round((usdCents * pricePerUsdCents) / 100);
}
