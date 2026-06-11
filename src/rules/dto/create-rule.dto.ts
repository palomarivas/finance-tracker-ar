import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RuleMatchType } from '../enums/rule-match-type.enum';

export class CreateRuleDto {
  @IsUUID()
  categoryId: string;

  @IsEnum(RuleMatchType)
  matchType: RuleMatchType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pattern: string;

  /** Higher wins when several rules match. */
  @IsOptional()
  @IsInt()
  priority?: number;
}
