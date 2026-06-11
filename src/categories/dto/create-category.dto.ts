import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CategoryKind } from '../enums/category-kind.enum';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsEnum(CategoryKind)
  kind: CategoryKind;

  /** Optional parent (own category or a shared system one, same kind). */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
