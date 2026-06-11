import { CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Shared base for every domain entity: a UUID primary key and a created_at
 * timestamp. Column names are converted to snake_case by the naming strategy.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
