/**
 * Argentina has several USD exchange rates, each with a different role.
 * Values map to dolarapi.com "casa" names (see FxService).
 *
 *   OFICIAL  -> oficial          TARJETA -> tarjeta (oficial + 30% percepción)
 *   BLUE     -> blue             MEP     -> bolsa
 *   CCL      -> contadoconliqui  MAYORISTA -> mayorista
 *   CRIPTO   -> cripto           (reserved; crypto is out of scope for v1)
 */
export enum RateType {
  OFICIAL = 'OFICIAL',
  TARJETA = 'TARJETA',
  BLUE = 'BLUE',
  MEP = 'MEP',
  CCL = 'CCL',
  MAYORISTA = 'MAYORISTA',
  CRIPTO = 'CRIPTO',
}
