import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Currency } from '../../common/enums/currency.enum';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';
import { RateType } from '../enums/rate-type.enum';

/**
 * A USD/ARS quote for a given rate type and day. Synced from dolarapi.com (live)
 * and ArgentinaDatos (historical). One row per (rateType, date).
 */
@Entity('exchange_rates')
@Index(['rateType', 'date'], { unique: true })
export class ExchangeRate extends BaseEntity {
  @Column({ type: 'enum', enum: RateType })
  rateType: RateType;

  @Column({ type: 'enum', enum: Currency, default: Currency.USD })
  baseCurrency: Currency;

  @Column({ type: 'enum', enum: Currency, default: Currency.ARS })
  quoteCurrency: Currency;

  @Column({ type: 'date' })
  date: string;

  /** Buy (compra) price in cents of the quote currency. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  buyCents: number;

  /** Sell (venta) price in cents of the quote currency. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  sellCents: number;

  /** Provenance, e.g. "dolarapi", "argentinadatos". */
  @Column()
  source: string;
}
