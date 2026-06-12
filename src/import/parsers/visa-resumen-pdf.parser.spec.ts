import { Currency } from '../../common/enums/currency.enum';
import { TransactionType } from '../../transactions/enums/transaction-type.enum';
import { VisaResumenPdfParser } from './visa-resumen-pdf.parser';

/**
 * Synthetic fixture replicating the column layout pdf-parse extracts from a
 * Santander VISA resumen. All names/amounts invented; spacing matters — the
 * pesos column ends near col 90, the U$S column beyond col 97.
 */
const L = (s: string) => s; // readability helper

const SYNTHETIC_RESUMEN = [
  'Santander Río',
  'RESUMEN DE CUENTA',
  'VISA',
  'FechaComprobante Referencia$U$S',
  'PERSONA FICTICIA                        ',
  '1234 CIUDAD                             CIERRE  28 May 26VENCIMIENTO 05 Jun 26',
  'Cierre Ant.: 30 Abr 26Vto. Ant.: 08 May 26',
  'LIMITES:COMPRA   $   1.000.000,00                           FINANCIACION  $     900.000,00',
  L('                        SALDO ANTERIOR                                           100.000,00               1,00          '),
  L('26 Mayo    04           SU PAGO EN PESOS                                         550.000,00-                            '),
  L('25 Junio   01 622695 *  TIENDA INVENTADA            C.12/12                       35.550,00                             '),
  L('26 Mayo    03 402601 K  MERPAGO*COMERCIOFALSO                                      3.490,00                             '),
  L('           06 769083    SERVICIO.WEB SUBSCR abc123USD       20,00                                        20,00          '),
  L('           13 001121 K  PROPINA*APPDELIVERY                                        5.480,00                             '),
  L('Tarjeta 1111 Total Consumos de PERSONA FICTICIA                                   99.294,85 *            0,00 *         '),
  L('26 Mayo    28           INTERESES FINANCIACION    $                               22.242,53                             '),
  L("           28           DB.RG 5617  30% (    31060,87 )                            9.318,26                             "),
  '                Plan V: abonando el pago mínimo de $      236010,00 usted puede cancelar en cuotas',
  '                      3 cuotas de $ 572079,76 (TNA Fija:  81,800% - TEA:  120,709%) *',
].join('\n');

describe('VisaResumenPdfParser.parseText', () => {
  const parser = new VisaResumenPdfParser();

  it('extracts CIERRE/VENCIMIENTO as the statement metadata', () => {
    const { creditCardMeta } = parser.parseText(SYNTHETIC_RESUMEN);
    expect(creditCardMeta).toEqual({
      closingDate: '2026-05-28',
      dueDate: '2026-06-05',
    });
  });

  it('parses ARS consumptions as negative expenses with installment markers kept', () => {
    const { rows } = parser.parseText(SYNTHETIC_RESUMEN);
    const cuota = rows.find((r) => r.description.includes('TIENDA INVENTADA'));
    expect(cuota).toMatchObject({
      amountCents: -3555000,
      currency: Currency.ARS,
    });
    expect(cuota?.description).toContain('C.12/12');
    expect(cuota?.postedAt.toISOString()).toBe('2025-06-01T12:00:00.000Z');
  });

  it('carries year/month over to continuation lines', () => {
    const { rows } = parser.parseText(SYNTHETIC_RESUMEN);
    const propina = rows.find((r) => r.description.includes('PROPINA'));
    expect(propina?.postedAt.toISOString()).toBe('2026-05-13T12:00:00.000Z');
  });

  it('classifies the far-right column as USD', () => {
    const { rows } = parser.parseText(SYNTHETIC_RESUMEN);
    const usd = rows.find((r) => r.currency === Currency.USD);
    expect(usd).toMatchObject({ amountCents: -2000, currency: Currency.USD });
    expect(usd?.description).toContain('SERVICIO.WEB');
  });

  it('marks payments (trailing minus) as positive TRANSFER rows', () => {
    const { rows } = parser.parseText(SYNTHETIC_RESUMEN);
    const pago = rows.find((r) => r.description.includes('SU PAGO'));
    expect(pago).toMatchObject({
      amountCents: 55000000,
      typeHint: TransactionType.TRANSFER,
    });
  });

  it('imports interest but skips percepción, totals and saldo anterior', () => {
    const { rows } = parser.parseText(SYNTHETIC_RESUMEN);
    expect(rows.some((r) => r.description.includes('INTERESES'))).toBe(true);
    expect(rows.some((r) => /RG 5617/.test(r.description))).toBe(false);
    expect(rows.some((r) => /Total Consumos/i.test(r.description))).toBe(false);
    expect(rows.some((r) => /SALDO ANTERIOR/i.test(r.description))).toBe(false);
  });
});
