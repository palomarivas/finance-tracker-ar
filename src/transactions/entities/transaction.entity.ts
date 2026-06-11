import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Currency } from '../../common/enums/currency.enum';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';
import { CreditCardStatement } from '../../import/entities/credit-card-statement.entity';
import { ImportBatch } from '../../import/entities/import-batch.entity';
import { User } from '../../users/entities/user.entity';
import { TransactionSource } from '../enums/transaction-source.enum';
import { TransactionType } from '../enums/transaction-type.enum';

/**
 * The core entity. `amountCents` is the source of truth in the transaction's
 * native currency; the ARS valuation fields are frozen only for USD card spend.
 */
@Entity('transactions')
// Re-importing an overlapping statement collides here and is skipped (not errored).
@Index(['account', 'fingerprint'], { unique: true })
@Index(['postedAt'])
@Index(['transferGroupId'])
export class Transaction extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  account: Account;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  category: Category | null;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /** Amount in the transaction's native currency cents (source of truth). */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amountCents: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  merchant: string | null;

  /** Real transaction date, distinct from createdAt (the row's insertion time). */
  @Column({ type: 'timestamptz' })
  postedAt: Date;

  @Column({ type: 'enum', enum: TransactionSource, default: TransactionSource.MANUAL })
  source: TransactionSource;

  /** sha256(accountId + postedAt + amount + normalizedDescription) — dedup hash. */
  @Column()
  fingerprint: string;

  /** Links the two legs of a transfer (out of A, into B). */
  @Column({ type: 'uuid', nullable: true })
  transferGroupId: string | null;

  @ManyToOne(() => ImportBatch, (batch) => batch.transactions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  importBatch: ImportBatch | null;

  @ManyToOne(() => CreditCardStatement, (statement) => statement.transactions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  creditCardStatement: CreditCardStatement | null;

  // --- FX valuation (frozen only for USD credit-card spend; null otherwise) ---

  /** Native amount converted at the OFICIAL rate on postedAt. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  baseArsCents: number | null;

  /** The dólar-tarjeta 30% percepción: (tarjeta − oficial) conversion on postedAt. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
  perceptionArsCents: number | null;

  /** True once the percepción is reversed (resumen paid in USD before due date). */
  @Column({ type: 'boolean', default: false })
  perceptionReversed: boolean;
}
