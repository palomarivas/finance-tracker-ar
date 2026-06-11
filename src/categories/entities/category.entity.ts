import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { CategoryKind } from '../enums/category-kind.enum';

/**
 * Hierarchical category. A null `user` marks a shared system-default category.
 */
@Entity('categories')
export class Category extends BaseEntity {
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  user: User | null;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: CategoryKind })
  kind: CategoryKind;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
