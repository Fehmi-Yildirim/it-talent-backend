import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateJobRequirementDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether the skill is mandatory for the job.',
    example: true,
  })
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    description: 'Minimum required skill level.',
    example: 4,
  })
  minimumLevel?: number;
}
