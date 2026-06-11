import { Currency } from '../../common/enums/currency.enum';

/** One normalized movement extracted from a statement, before persistence. */
export interface ParsedRow {
  postedAt: Date;
  description: string;
  /** Signed: negative = money out, positive = money in. */
  amountCents: number;
  currency: Currency;
  merchant?: string;
  /**
   * Stable id from the source (e.g. MercadoPago's operation id). When present
   * it anchors the dedup fingerprint, surviving description/format changes.
   */
  externalId?: string;
}

/**
 * Strategy interface: one implementation per bank/wallet export format.
 * Every Argentine bank exports a slightly different file — that mess stays
 * isolated behind this interface. Implementations are injected as an array
 * via the STATEMENT_PARSERS token; the first whose canParse() returns true wins.
 */
export interface StatementParser {
  /** Short id used in logs and batch records, e.g. "mercadopago-pdf". */
  readonly name: string;

  canParse(filename: string, sample: Buffer): Promise<boolean> | boolean;

  parse(buffer: Buffer): Promise<ParsedRow[]>;
}

export const STATEMENT_PARSERS = Symbol('STATEMENT_PARSERS');
