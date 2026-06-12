import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

/** v1: only the category is editable (imported data stays source-of-truth). */
export class UpdateTransactionDto {
  /** A category id, or null to clear back to uncategorized. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;
}
