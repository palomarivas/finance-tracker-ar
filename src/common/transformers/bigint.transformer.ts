import { ValueTransformer } from 'typeorm';

/**
 * Money is ALWAYS stored as integer cents in a Postgres `bigint` column and
 * read back into JS as a `number`. This is non-negotiable: floating-point money
 * silently corrupts sums. Use this transformer on every `*_cents` column.
 *
 *   @Column({ type: 'bigint', transformer: bigintTransformer })
 *   amountCents: number;
 *
 * Note: JS `number` is safe up to 2^53-1 cents (~90 trillion units), far beyond
 * any personal-finance balance, so the narrowing on read is intentional and safe.
 */
export class BigintTransformer implements ValueTransformer {
  /** JS number -> string for the bigint column on write. */
  to(value: number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  }

  /** Postgres returns bigint as a string -> JS number on read. */
  from(value: string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Number(value);
  }
}

export const bigintTransformer = new BigintTransformer();
