import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { EmploymentType, WorkMode } from '../../../generated/prisma/client';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsEnum(WorkMode)
  workMode: WorkMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiPropertyOptional({
    description: 'UUIDs of skills that are mandatory for the job.',
    example: ['11111111-1111-4111-8111-111111111111'],
  })
  requiredSkillIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiPropertyOptional({
    description: 'UUIDs of skills that are preferred but not mandatory.',
    example: ['22222222-2222-4222-8222-222222222222'],
  })
  preferredSkillIds?: string[];
}
