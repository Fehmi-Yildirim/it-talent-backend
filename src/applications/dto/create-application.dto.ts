import {
    IsBoolean,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateApplicationDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    coverLetter?: string

    @IsOptional()
    @Transform(({ value }: { value: unknown }): unknown => {
        if (value === 'true') return true
        if (value === 'false') return false
        return value
    })
    @IsBoolean()
    cvRetentionConsent?: boolean
}
