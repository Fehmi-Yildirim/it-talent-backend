import { IsEnum, IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { CandidateSkillSource } from '../../../../generated/prisma/enums';

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

    @IsEnum(CandidateSkillSource)
    source: CandidateSkillSource;
}