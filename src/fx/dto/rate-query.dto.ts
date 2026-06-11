import { IsEnum, IsOptional, Matches } from 'class-validator';
import { RateType } from '../enums/rate-type.enum';

export class LatestRateQueryDto {
  @IsEnum(RateType)
  rateType: RateType;

  /** Optional historical date (YYYY-MM-DD). Omit for the latest stored rate. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
