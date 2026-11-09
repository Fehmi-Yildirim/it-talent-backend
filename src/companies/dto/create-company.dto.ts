import {
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description: string;

  @IsString()
  @IsUrl()
  @MaxLength(255)
  website: string;

  @IsString()
  @MaxLength(255)
  location: string;
}
