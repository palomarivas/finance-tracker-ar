import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { RuleMatchType } from '../enums/rule-match-type.enum';

/**
 * Auto-categorization rule. `pattern` is matched (case-insensitively) against a
 * transaction's description; higher `priority` wins when several rules match.
 */
@Entity('rules')
export class Rule extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  category: Category;

  @Column({ type: 'enum', enum: RuleMatchType })
  matchType: RuleMatchType;

  @Column()
  pattern: string;

  @Column({ type: 'int', default: 0 })
  priority: number;
}
