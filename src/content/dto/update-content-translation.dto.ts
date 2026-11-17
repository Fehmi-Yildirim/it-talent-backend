import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsTiptapJson } from '../validators/tiptap-json.validator';

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
  @IsTiptapJson()
  draftContent?: Record<string, unknown>;
}
