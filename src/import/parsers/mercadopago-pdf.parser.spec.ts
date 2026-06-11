import { Currency } from '../../common/enums/currency.enum';
import { MercadoPagoPdfParser } from './mercadopago-pdf.parser';

/**
 * Synthetic fixture mimicking the text layout pdf-parse extracts from a real
 * MercadoPago "Resumen de cuenta en pesos" PDF. All data here is invented.
 */
const SYNTHETIC_STATEMENT = `

1/2
RESUMEN DE CUENTA EN PESOS
Juana Ficticia
CVU: 0000000000000000000000 20111111112CUIT/ CUIL:
 Del 1 al 31 de mayo de 2026Periodo:
Saldo inicial: $ 1.000,00
Entradas: $ 50.000,00
Salidas: $ -30.500,50
Saldo final: $ 20.499,50
DETALLE DE MOVIMIENTOS
FechaDescripción
ID de la
operación
ValorSaldo
02-05-2026
Ingreso de dinero
100000000001$ 50.000,00$ 51.000,00
03-05-2026
Transferencia enviada Almacén
Don Inventado
100000000002$ -10.000,00$ 41.000,00
04-05-2026
Rendimientos
900000000001$ 0,50$ 41.000,50

2/2
FechaDescripción
ID de la
operación
ValorSaldo
05-05-2026
Pago Supermercado Imaginario
Sucursal Centro
100000000003$ -20.500,50$ 20.500,00
Fecha de generación: 11-06-2026
Mercado Libre S.R.L. CUIT 30-00000000-0 Dirección Falsa 123
de consulta en: www.example.com
`;

describe('MercadoPagoPdfParser.parseText', () => {
  const parser = new MercadoPagoPdfParser();

  it('extracts every movement with date, amount, and operation id', () => {
    const rows = parser.parseText(SYNTHETIC_STATEMENT);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toMatchObject({
      description: 'Ingreso de dinero',
      amountCents: 5000000,
      currency: Currency.ARS,
      externalId: '100000000001',
    });
    expect(rows[0].postedAt.toISOString()).toBe('2026-05-02T12:00:00.000Z');
  });

  it('joins multi-line descriptions', () => {
    const rows = parser.parseText(SYNTHETIC_STATEMENT);
    expect(rows[1].description).toBe('Transferencia enviada Almacén Don Inventado');
    expect(rows[1].amountCents).toBe(-1000000);
  });

  it('survives page breaks mid-listing and skips headers/footers', () => {
    const rows = parser.parseText(SYNTHETIC_STATEMENT);
    expect(rows[3]).toMatchObject({
      description: 'Pago Supermercado Imaginario Sucursal Centro',
      amountCents: -2050050,
      externalId: '100000000003',
    });
  });

  it('ignores summary amounts outside movements', () => {
    const rows = parser.parseText(SYNTHETIC_STATEMENT);
    const total = rows.reduce((sum, r) => sum + r.amountCents, 0);
    // 50.000,00 - 10.000,00 + 0,50 - 20.500,50 = 19.500,00
    expect(total).toBe(1950000);
  });
});
