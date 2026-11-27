import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { IsTiptapJson } from '../validators/tiptap-json.validator';

export class UpdateContentTranslationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsTiptapJson()
  content?: Prisma.InputJsonValue;
}
