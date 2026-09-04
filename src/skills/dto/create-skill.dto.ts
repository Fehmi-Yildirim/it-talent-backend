import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { SkillCategory } from '../../../generated/prisma/enums';

export class CreateSkillDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsString()
  @Length(2, 100)
  slug: string;

  @IsEnum(SkillCategory)
  category: SkillCategory;

  @IsOptional()
  @IsString()
  description?: string;
}
