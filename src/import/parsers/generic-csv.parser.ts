import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Currency } from '../../common/enums/currency.enum';
import {
  arAmountToCents,
  arDateToDate,
} from './parse-ar.util';
import { ParsedRow, StatementParser } from './statement-parser.interface';

/**
 * Fallback parser for arbitrary CSV exports. Maps columns by header name
 * (Spanish and English synonyms) and deliberately IGNORES columns it doesn't
 * know: providers add fields over time (e.g. MercadoPago's "sub_unit" gained
 * new values in 2026), and a strict parser would break on every addition.
 */
@Injectable()
export class GenericCsvParser implements StatementParser {
  readonly name = 'generic-csv';

  private static readonly HEADERS = {
    date: ['fecha', 'date', 'fecha de pago', 'release_date', 'fecha de operacion'],
    description: ['descripcion', 'descripción', 'description', 'detalle', 'concepto', 'movimiento'],
    amount: ['importe', 'monto', 'amount', 'valor', 'net_amount', 'transaction_amount'],
    currency: ['moneda', 'currency'],
    externalId: ['id', 'id de operacion', 'id de la operacion', 'operation_id', 'source_id', 'comprobante'],
    merchant: ['comercio', 'merchant', 'contraparte', 'counterpart_name'],
  };

  canParse(filename: string, sample: Buffer): boolean {
    if (!/\.csv$/i.test(filename)) {
      return false;
    }
    const firstLine = sample.toString('utf8').split(/\r?\n/, 1)[0] ?? '';
    const headers = this.splitHeader(firstLine);
    return (
      this.findIndex(headers, GenericCsvParser.HEADERS.date) >= 0 &&
      this.findIndex(headers, GenericCsvParser.HEADERS.amount) >= 0
    );
  }

  parse(buffer: Buffer): Promise<ParsedRow[]> {
    const content = buffer.toString('utf8');
    const delimiter = this.sniffDelimiter(content);
    const records = parse(content, {
      delimiter,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as string[][];

    if (records.length < 2) {
      return Promise.resolve([]);
    }
    const headers = records[0].map((h) => this.normalizeHeader(h));
    const col = {
      date: this.findIndex(headers, GenericCsvParser.HEADERS.date),
      description: this.findIndex(headers, GenericCsvParser.HEADERS.description),
      amount: this.findIndex(headers, GenericCsvParser.HEADERS.amount),
      currency: this.findIndex(headers, GenericCsvParser.HEADERS.currency),
      externalId: this.findIndex(headers, GenericCsvParser.HEADERS.externalId),
      merchant: this.findIndex(headers, GenericCsvParser.HEADERS.merchant),
    };

    const rows: ParsedRow[] = [];
    for (const record of records.slice(1)) {
      const postedAt = this.parseDate(record[col.date] ?? '');
      const amountCents = arAmountToCents(record[col.amount] ?? '');
      if (!postedAt || amountCents === null) {
        continue; // not a data row (subtotals, blank padding, etc.)
      }
      rows.push({
        postedAt,
        description: col.description >= 0 ? (record[col.description] ?? '').trim() : '',
        amountCents,
        currency: this.parseCurrency(col.currency >= 0 ? record[col.currency] : undefined),
        externalId: col.externalId >= 0 ? record[col.externalId]?.trim() || undefined : undefined,
        merchant: col.merchant >= 0 ? record[col.merchant]?.trim() || undefined : undefined,
      });
    }
    return Promise.resolve(rows);
  }

  private parseDate(raw: string): Date | null {
    const trimmed = raw.trim();
    // ISO first (2026-05-01), then Argentine (01-05-2026 / 01/05/26).
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (iso) {
      return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12));
    }
    return arDateToDate(trimmed);
  }

  private parseCurrency(raw: string | undefined): Currency {
    return raw?.trim().toUpperCase() === 'USD' ? Currency.USD : Currency.ARS;
  }

  private sniffDelimiter(content: string): string {
    const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
    return (firstLine.match(/;/g)?.length ?? 0) >
      (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  }

  private splitHeader(line: string): string[] {
    return line.split(/[;,]/).map((h) => this.normalizeHeader(h));
  }

  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/["']/g, '')
      .trim();
  }

  private findIndex(headers: string[], synonyms: string[]): number {
    return headers.findIndex((h) => synonyms.includes(h));
  }
}
