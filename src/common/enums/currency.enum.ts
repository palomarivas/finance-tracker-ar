/**
 * Currencies the tracker handles. Stored on accounts, transactions and rates.
 * Crypto is intentionally out of scope for v1 (see RateType for the reserved slot).
 */
export enum Currency {
  ARS = 'ARS',
  USD = 'USD',
}
