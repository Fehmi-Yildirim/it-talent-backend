import { IsArray, IsOptional, IsUUID } from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateJobRequirementsDto {
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
