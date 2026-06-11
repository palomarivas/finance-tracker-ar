import { IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { Currency } from '../../common/enums/currency.enum';

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(Currency)
  baseCurrency?: Currency;
}
