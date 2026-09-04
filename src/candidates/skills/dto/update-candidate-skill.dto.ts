import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCandidateSkillDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  proficiencyLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsOfExperience?: number;
}
