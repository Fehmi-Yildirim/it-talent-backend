import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsTiptapJson } from '../validators/tiptap-json.validator';

export class UpdateContentTranslationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  draftTitle?: string;

  @IsOptional()
  @IsTiptapJson()
  draftContent?: Record<string, unknown>;
}
