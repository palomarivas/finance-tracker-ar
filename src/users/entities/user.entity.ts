import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Currency } from '../../common/enums/currency.enum';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email: string;

  @Column()
  passwordHash: string;

  /**
   * Reporting currency. Balances may be held in USD, but everything is reported
   * back to the user in this currency (default ARS).
   */
  @Column({ type: 'enum', enum: Currency, default: Currency.ARS })
  baseCurrency: Currency;
}
