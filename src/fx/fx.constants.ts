import { RateType } from './enums/rate-type.enum';

/**
 * Maps our RateType to dolarapi.com / ArgentinaDatos "casa" names.
 * Keep this as the single source of truth for the mapping in both directions.
 */
export const RATE_TYPE_TO_CASA: Record<RateType, string> = {
  [RateType.OFICIAL]: 'oficial',
  [RateType.TARJETA]: 'tarjeta',
  [RateType.BLUE]: 'blue',
  [RateType.MEP]: 'bolsa',
  [RateType.CCL]: 'contadoconliqui',
  [RateType.MAYORISTA]: 'mayorista',
  [RateType.CRIPTO]: 'cripto',
};

export const CASA_TO_RATE_TYPE: Record<string, RateType> = Object.entries(
  RATE_TYPE_TO_CASA,
).reduce<Record<string, RateType>>((acc, [rateType, casa]) => {
  acc[casa] = rateType as RateType;
  return acc;
}, {});

export const DOLARAPI_BASE_URL = 'https://dolarapi.com/v1';
export const ARGENTINADATOS_BASE_URL = 'https://api.argentinadatos.com/v1';
