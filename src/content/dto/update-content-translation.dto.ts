import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Prisma } from '../../../generated/prisma/client';
import { ContentStatus } from '../../../generated/prisma/enums';
import { IsTiptapJson } from '../validators/tiptap-json.validator';

export class UpdateContentTranslationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsTiptapJson()
  content?: Prisma.InputJsonValue;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
