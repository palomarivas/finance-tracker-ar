import { Currency } from '../../common/enums/currency.enum';
import { GenericCsvParser } from './generic-csv.parser';

describe('GenericCsvParser', () => {
  const parser = new GenericCsvParser();

  const csv = (content: string) => Buffer.from(content, 'utf8');

  it('canParse requires .csv with date and amount headers', () => {
    expect(parser.canParse('movs.csv', csv('fecha;descripcion;importe\n'))).toBe(true);
    expect(parser.canParse('movs.csv', csv('foo;bar;baz\n'))).toBe(false);
    expect(parser.canParse('movs.pdf', csv('fecha;descripcion;importe\n'))).toBe(false);
  });

  it('parses semicolon-delimited Argentine CSV', async () => {
    const rows = await parser.parse(
      csv(
        'fecha;descripcion;importe;moneda\n' +
          '01/05/26;Compra ficticia;-1.234,56;ARS\n' +
          '02/05/26;Sueldo;1.000.000,00;ARS\n',
      ),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      description: 'Compra ficticia',
      amountCents: -123456,
      currency: Currency.ARS,
    });
    expect(rows[1].amountCents).toBe(100000000);
  });

  it('parses ISO dates and USD currency', async () => {
    const rows = await parser.parse(
      csv('date,description,amount,currency\n2026-05-03,Suscripción,-20.00,USD\n'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].currency).toBe(Currency.USD);
    expect(rows[0].postedAt.toISOString()).toBe('2026-05-03T12:00:00.000Z');
  });

  it('IGNORES unknown columns (providers add fields like sub_unit over time)', async () => {
    const rows = await parser.parse(
      csv(
        'fecha;sub_unit;descripcion;importe;plataforma de cobro\n' +
          '01/05/26;checkout_pro;Venta;5.000,00;mp\n',
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(500000);
  });

  it('skips non-data rows (subtotals, blanks) instead of failing', async () => {
    const rows = await parser.parse(
      csv(
        'fecha;descripcion;importe\n' +
          '01/05/26;Compra;-100,00\n' +
          ';Saldo total;\n' +
          'TOTAL;;\n',
      ),
    );
    expect(rows).toHaveLength(1);
  });
});
