import { IsInt, Min } from 'class-validator';

/** Only the cap is mutable; move a budget by deleting and recreating it. */
export class UpdateBudgetDto {
  @IsInt()
  @Min(1)
  amountCents: number;
}
