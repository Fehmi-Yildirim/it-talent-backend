import {
  IsIn,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsIn(['nl', 'en'])
  locale: 'nl' | 'en';

  @IsObject()
  content: Record<string, unknown>;
}
