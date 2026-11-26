import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    Max,
    Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 20;

    @ApiPropertyOptional({
        enum: ['all', 'strong', 'partial', 'none'],
        default: 'all',
        description: 'Filter candidates by their overall match score',
    })
    @IsOptional()
    @IsIn(['all', 'strong', 'partial', 'none'])
    scoreRange: 'all' | 'strong' | 'partial' | 'none' = 'all';
}
