import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Currency } from '../../common/enums/currency.enum';
import { RateType } from '../../fx/enums/rate-type.enum';
import { AccountType } from '../enums/account-type.enum';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  institution?: string;

  @IsEnum(Currency)
  currency: Currency;

  /** Only meaningful for USD accounts; defaults to MEP there (see service). */
  @IsOptional()
  @IsEnum(RateType)
  valuationRateType?: RateType;
}
