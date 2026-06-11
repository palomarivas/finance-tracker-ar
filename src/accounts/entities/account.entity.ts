import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Currency } from '../../common/enums/currency.enum';
import { RateType } from '../../fx/enums/rate-type.enum';
import { User } from '../../users/entities/user.entity';
import { AccountType } from '../enums/account-type.enum';

/** One financial source: a bank account, card, wallet or cash stash. */
@Entity('accounts')
export class Account extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  /** Free text, e.g. "Banco Galicia", "MercadoPago". */
  @Column({ type: 'varchar', nullable: true })
  institution: string | null;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  /**
   * Which USD rate values this account in ARS (mark-to-market for USD holdings).
   * Null for ARS accounts. See FxService valuation logic.
   */
  @Column({ type: 'enum', enum: RateType, nullable: true })
  valuationRateType: RateType | null;
}
