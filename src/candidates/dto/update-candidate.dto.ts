import {
    IsDateString,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class UpdateCandidateDto {
    @IsOptional()
    @IsString()
    headline?: string;

    @IsOptional()
    @IsString()
    summary?: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    salaryMin?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    salaryMax?: number;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsDateString()
    availabilityDate?: string;

    @IsOptional()
    @IsString()
    remotePreference?: string;
}