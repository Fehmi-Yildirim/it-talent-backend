import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SkillCategory } from '../../../generated/prisma/enums';

export class GetSkillsDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(SkillCategory)
    category?: SkillCategory;
}