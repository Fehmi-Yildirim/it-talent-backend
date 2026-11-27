import { IsEnum } from 'class-validator';
import { ContentStatus } from '../../../generated/prisma/enums';

export class UpdateContentStatusDto {
    @IsEnum(ContentStatus)
    status: ContentStatus;
}
