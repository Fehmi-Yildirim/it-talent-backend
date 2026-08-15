import {
    IsEnum,
    IsNumber,
    IsOptional,
    Min,
} from 'class-validator';

import { CandidateSkillSource } from '../../../../generated/prisma/enums';

export class UpdateCandidateSkillDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    proficiencyLevel?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    yearsOfExperience?: number;

    @IsOptional()
    @IsEnum(CandidateSkillSource)
    source?: CandidateSkillSource;
}