import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateContentDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
}
