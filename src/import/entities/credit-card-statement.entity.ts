import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Currency } from '../../common/enums/currency.enum';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import { StatementStatus } from '../enums/statement-status.enum';

/**
 * A credit-card "resumen". How it is paid (`paymentCurrency`) decides whether the
 * dólar-tarjeta 30% percepción sticks or gets reversed — see Transaction FX fields.
 */
@Entity('credit_card_statements')
export class CreditCardStatement extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  /** The credit-card account this resumen belongs to. */
  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  account: Account;

  @Column({ type: 'date' })
  closingDate: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'enum', enum: Currency })
  paymentCurrency: Currency;

  @Column({ type: 'enum', enum: StatementStatus, default: StatementStatus.OPEN })
  status: StatementStatus;

  @OneToMany(() => Transaction, (transaction) => transaction.creditCardStatement)
  transactions: Transaction[];
}
