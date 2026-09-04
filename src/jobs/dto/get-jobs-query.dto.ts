import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GetJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Search in job title, description, or company name',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    enum: ['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE'],
  })
  @IsOptional()
  @IsEnum(['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE'])
  workMode?: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE';

  @ApiPropertyOptional({
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'],
  })
  @IsOptional()
  @IsEnum([
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'FREELANCE',
    'INTERNSHIP',
  ])
  employmentType?:
    | 'FULL_TIME'
    | 'PART_TIME'
    | 'CONTRACT'
    | 'FREELANCE'
    | 'INTERNSHIP';

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'Comma-separated skill UUIDs',
    type: [String],
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }): string[] | undefined => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value === 'string') {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }

      if (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string')
      ) {
        return value;
      }

      return undefined;
    },
  )
  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({
    enum: ['newest', 'salary', 'title'],
    default: 'newest',
  })
  @IsOptional()
  @IsEnum(['newest', 'salary', 'title'])
  sort?: 'newest' | 'salary' | 'title';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
