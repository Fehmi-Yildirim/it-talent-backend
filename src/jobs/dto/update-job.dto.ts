import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
} from 'class-validator';

import { EmploymentType, WorkMode } from '../../../generated/prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateJobDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(EmploymentType)
    employmentType?: EmploymentType;

    @IsOptional()
    @IsEnum(WorkMode)
    workMode?: WorkMode;

    @IsOptional()
    @IsInt()
    @Min(0)
    salaryMin?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    salaryMax?: number;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsUUID('4', { each: true })
    @ApiPropertyOptional({
        description:
            'Replaces the complete list of required skills when provided.',
    })
    requiredSkillIds?: string[];

    @IsOptional()
    @IsUUID('4', { each: true })
    @ApiPropertyOptional({
        description:
            'Replaces the complete list of preferred skills when provided.',
    })
    preferredSkillIds?: string[];
}
