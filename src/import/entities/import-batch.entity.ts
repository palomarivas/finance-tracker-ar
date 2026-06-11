import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import { ImportBatchStatus } from '../enums/import-batch-status.enum';

/**
 * Tracks one uploaded statement. Owning the transactions it created means a bad
 * import can be undone in a single query.
 */
@Entity('import_batches')
export class ImportBatch extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Account, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  account: Account;

  @Column()
  filename: string;

  @Column({ type: 'enum', enum: ImportBatchStatus, default: ImportBatchStatus.PENDING })
  status: ImportBatchStatus;

  @Column({ type: 'int', default: 0 })
  rowsImported: number;

  @Column({ type: 'int', default: 0 })
  rowsSkipped: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @OneToMany(() => Transaction, (transaction) => transaction.importBatch)
  transactions: Transaction[];
}
