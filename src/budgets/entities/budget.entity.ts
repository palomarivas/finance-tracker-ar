import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';
import { User } from '../../users/entities/user.entity';

/** Monthly spend cap for a category, in the user's base currency. */
@Entity('budgets')
@Index(['user', 'category', 'periodMonth'], { unique: true })
export class Budget extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  category: Category;

  /** Cap in base-currency cents. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amountCents: number;

  /** First day of the budgeted month. */
  @Column({ type: 'date' })
  periodMonth: string;
}
