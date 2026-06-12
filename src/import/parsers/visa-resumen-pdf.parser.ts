import { Injectable } from '@nestjs/common';
import pdfParse = require('pdf-parse');
import { Currency } from '../../common/enums/currency.enum';
import { TransactionType } from '../../transactions/enums/transaction-type.enum';
import { arAmountToCents } from './parse-ar.util';
import {
  CreditCardMeta,
  ParsedRow,
  ParsedStatement,
  StatementParser,
} from './statement-parser.interface';

/**
 * Parses Santander VISA credit-card resúmenes.
 *
 * The extracted text lays movements out in fixed-ish columns:
 *
 *   26 Mayo    03 402601 K  MERPAGO*MELI                          3.490,00
 *              06 769083    CLAUDE.AI SUBSCR ...USD  20,00                   20,00
 *   25 Junio   01 622695 *  DLO*Duvet Home       C.12/12         35.550,00
 *   26 Mayo    04           SU PAGO EN PESOS                    550.000,00-
 *
 * - "26 Mayo" = year 2026, Spanish month; continuation lines carry the last
 *   year/month and give only the day.
 * - Trailing "-" marks credits (payments).
 * - Two amount columns: pesos ends around col 90, U$S beyond — distinguished
 *   by end position of the final amount token.
 * - "C.NN/MM" = installment NN of MM, kept inside the description.
 */
@Injectable()
export class VisaResumenPdfParser implements StatementParser {
  readonly name = 'visa-resumen-pdf';

  /** End-column threshold separating the $ column from the U$S column. */
  private static readonly USD_COLUMN_START = 97;

  private static readonly MONTHS: Record<string, number> = {
    ener: 1, febr: 2, marz: 3, abri: 4, mayo: 5, juni: 6,
    juli: 7, agos: 8, sept: 9, seti: 9, octu: 10, novi: 11, dici: 12,
  };

  /** `26 Mayo    03 ...` or continuation `           06 ...` */
  private static readonly MOVEMENT_LINE =
    /^(?:(\d{2}) ([A-Za-zÁ-ú]+)\.?\s+)?(\d{2})\s+(?:(\d{6})\s+)?(?:[*K]\s+)?(\S.*)$/;

  private static readonly AMOUNT_TOKEN = /(\d[\d.]*,\d{2})(-?)/g;

  /** Lines that are charges we skip or summaries, never movements. */
  private static readonly SKIP = [
    /Total Consumos/i,
    /SALDO ANTERIOR/i,
    /TRANSFERENCIA DEUDA/i, // USD-debt conversion legs — out of v1 scope
    /\bDB\.RG \d+/i, // the 30% percepción: modeled per-transaction, not imported
    /Plan V:/i,
    /cuotas de \$/i,
  ];

  async canParse(filename: string, sample: Buffer): Promise<boolean> {
    if (!sample.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      return false;
    }
    try {
      const { text } = await pdfParse(sample);
      return /RESUMEN DE CUENTA/i.test(text) && /VISA/.test(text) && /CIERRE/.test(text);
    } catch {
      return false;
    }
  }

  async parse(buffer: Buffer): Promise<ParsedStatement> {
    const { text } = await pdfParse(buffer);
    return this.parseText(text);
  }

  /** Pure text → statement step, exposed for unit tests. */
  parseText(text: string): ParsedStatement {
    const creditCardMeta = this.extractMeta(text);
    const rows: ParsedRow[] = [];
    let lastYearMonth: { year: number; month: number } | null = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/\s+$/, '');
      if (!line || VisaResumenPdfParser.SKIP.some((re) => re.test(line))) {
        continue;
      }

      const match = VisaResumenPdfParser.MOVEMENT_LINE.exec(line.trimStart());
      if (!match) {
        continue;
      }
      const [, yy, monthName, dd, comprobante, rest] = match;

      if (yy && monthName) {
        const month = VisaResumenPdfParser.MONTHS[
          monthName.slice(0, 4).toLowerCase()
        ];
        if (!month) {
          continue; // not actually a movement line
        }
        lastYearMonth = { year: 2000 + Number(yy), month };
      }
      if (!lastYearMonth) {
        continue;
      }

      const amounts = this.extractAmounts(line);
      if (amounts.length === 0 || !rest) {
        continue;
      }
      // The last amount token decides: its end column says which currency
      // column it sits in; trailing "-" marks a credit (payment).
      const last = amounts[amounts.length - 1];
      const isUsd = last.endCol >= VisaResumenPdfParser.USD_COLUMN_START;
      const cents = arAmountToCents(last.token + (last.negative ? '-' : ''));
      if (cents === null) {
        continue;
      }

      const description = this.cleanDescription(rest);
      if (!description) {
        continue;
      }
      const isPayment = last.negative;

      rows.push({
        postedAt: new Date(
          Date.UTC(lastYearMonth.year, lastYearMonth.month - 1, Number(dd), 12),
        ),
        description,
        // Consumptions are positive in the resumen but they are money OUT;
        // payments come with a trailing minus and are money IN to the card.
        amountCents: isPayment ? Math.abs(cents) : -Math.abs(cents),
        currency: isUsd ? Currency.USD : Currency.ARS,
        externalId: undefined, // comprobantes are short and reused; rely on the content fingerprint
        merchant: comprobante ? undefined : undefined,
        typeHint: isPayment ? TransactionType.TRANSFER : undefined,
      });
    }
    return { rows, creditCardMeta };
  }

  /** "CIERRE  28 May 26VENCIMIENTO 05 Jun 26" → ISO closing/due dates. */
  private extractMeta(text: string): CreditCardMeta | undefined {
    const re =
      /CIERRE\s+(\d{2}) ([A-Za-z]{3})\.? (\d{2})\s*VENCIMIENTO\s*(\d{2}) ([A-Za-z]{3})\.? (\d{2})/;
    const m = re.exec(text);
    if (!m) {
      return undefined;
    }
    const month = (abbr: string): number | undefined =>
      ({ ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 })[
        abbr.toLowerCase()
      ];
    const closing = month(m[2]);
    const due = month(m[5]);
    if (!closing || !due) {
      return undefined;
    }
    const iso = (yy: string, mm: number, dd: string) =>
      `20${yy}-${String(mm).padStart(2, '0')}-${dd}`;
    return {
      closingDate: iso(m[3], closing, m[1]),
      dueDate: iso(m[6], due, m[4]),
    };
  }

  private extractAmounts(
    line: string,
  ): { token: string; negative: boolean; endCol: number }[] {
    const out: { token: string; negative: boolean; endCol: number }[] = [];
    VisaResumenPdfParser.AMOUNT_TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VisaResumenPdfParser.AMOUNT_TOKEN.exec(line)) !== null) {
      out.push({
        token: m[1],
        negative: m[2] === '-',
        endCol: m.index + m[0].length,
      });
    }
    return out;
  }

  /** Strips the trailing amount columns off the description text. */
  private cleanDescription(rest: string): string {
    return rest
      .replace(/\s{2,}[\d.,\s-]*$/, '') // amounts + padding at the end
      .replace(/\s+/g, ' ')
      .trim();
  }
}
