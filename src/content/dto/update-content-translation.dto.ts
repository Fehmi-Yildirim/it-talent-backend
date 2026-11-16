import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContentTranslationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  draftTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  draftIntroduction?: string;

  @IsOptional()
  @IsObject()
  draftContent?: Record<string, unknown>;
}
