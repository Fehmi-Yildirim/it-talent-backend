import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsUUID, Min } from 'class-validator';

export class CreateJobRequirementDto {
  @IsUUID('4')
  @ApiProperty({
    description: 'UUID of the skill associated with the job requirement.',
    example: '11111111-1111-4111-8111-111111111111',
  })
  skillId: string;

  @IsBoolean()
  @ApiProperty({
    description: 'Whether the skill is mandatory for the job.',
    example: true,
  })
  required: boolean;

  @IsInt()
  @Min(1)
  @ApiProperty({
    description: 'Minimum required skill level.',
    example: 1,
  })
  minimumLevel: number;
}
