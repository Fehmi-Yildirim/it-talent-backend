import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CreateCandidateSkillDto {
    @IsUUID()
    skillId: string;

    @IsInt()
    @Min(1)
    @Max(5)
    proficiencyLevel: number;

    @IsNumber()
    @Min(0)
    yearsOfExperience: number;
}