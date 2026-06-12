import { IsInt, IsUUID, Matches, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsUUID()
  categoryId: string;

  /** Monthly cap in base-currency (ARS) cents. */
  @IsInt()
  @Min(1)
  amountCents: number;

  /** Budgeted month as YYYY-MM. */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month: string;
}
