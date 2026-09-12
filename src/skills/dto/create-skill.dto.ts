import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { SkillCategory } from '../../../generated/prisma/enums';

export class CreateSkillDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsEnum(SkillCategory)
  category: SkillCategory;

  @IsOptional()
  @IsString()
  description?: string;
}