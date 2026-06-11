import { Injectable } from '@nestjs/common';
import pdfParse = require('pdf-parse');
import { Currency } from '../../common/enums/currency.enum';
import { arAmountToCents, arDateToDate } from './parse-ar.util';
import { ParsedRow, StatementParser } from './statement-parser.interface';

/**
 * Parses MercadoPago "Resumen de cuenta en pesos" PDFs.
 *
 * The extracted text lays each movement out as:
 *
 *   01-05-2026                      <- date (DD-MM-YYYY)
 *   Transferencia enviada Antojos   <- description, possibly multi-line
 *   Kiosco y Almacén
 *   157334364122$ -13.200,00$ 1.113,34   <- operationId + valor + saldo
 *
 * interleaved with page headers/footers, which are skipped by pattern.
 */
@Injectable()
export class MercadoPagoPdfParser implements StatementParser {
  readonly name = 'mercadopago-pdf';

  private static readonly DATE_LINE = /^\d{2}-\d{2}-\d{4}$/;
  /** operationId + "$ valor" + "$ saldo", no separators in the raw text. */
  private static readonly TOTALS_LINE =
    /^(\d{6,})\$\s*(-?[\d.,]+)\$\s*(-?[\d.,]+)$/;
  private static readonly NOISE = [
    /^\d+\/\d+$/, // page marker "2/4"
    /^RESUMEN DE CUENTA/i,
    /^DETALLE DE MOVIMIENTOS/i,
    /^FechaDescripción/i,
    /^ID de la$/i,
    /^operación$/i,
    /^ValorSaldo$/i,
    /^Fecha de generación/i,
    /^Mercado Libre S\.R\.L\./i,
    /^de consulta en:/i,
  ];

  async canParse(filename: string, sample: Buffer): Promise<boolean> {
    if (!sample.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
      return false;
    }
    try {
      const { text } = await pdfParse(sample);
      return (
        /DETALLE DE MOVIMIENTOS/i.test(text) && /Mercado/i.test(text)
      );
    } catch {
      return false;
    }
  }

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const { text } = await pdfParse(buffer);
    return this.parseText(text);
  }

  /** Pure text → rows step, exposed for unit testing with synthetic fixtures. */
  parseText(text: string): ParsedRow[] {
    const rows: ParsedRow[] = [];
    let current: { postedAt: Date; descriptionParts: string[] } | null = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || MercadoPagoPdfParser.NOISE.some((re) => re.test(line))) {
        continue;
      }

      if (MercadoPagoPdfParser.DATE_LINE.test(line)) {
        const postedAt = arDateToDate(line);
        if (postedAt) {
          current = { postedAt, descriptionParts: [] };
        }
        continue;
      }

      const totals = MercadoPagoPdfParser.TOTALS_LINE.exec(line);
      if (totals && current) {
        const [, operationId, valor] = totals;
        const amountCents = arAmountToCents(valor);
        if (amountCents !== null) {
          rows.push({
            postedAt: current.postedAt,
            description: current.descriptionParts.join(' ').trim(),
            amountCents,
            currency: Currency.ARS,
            externalId: operationId,
          });
        }
        current = null;
        continue;
      }

      // Anything else between a date and its totals line is description text.
      if (current) {
        current.descriptionParts.push(line);
      }
    }
    return rows;
  }
}
