import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRecruiterDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;
}
