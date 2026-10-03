import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

export const CV_RETENTION_DAYS_SETTING = 'cv_retention_days'
export const DEFAULT_CV_RETENTION_DAYS = 28

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) { }

    async getCvRetentionDays(): Promise<number> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: {
                key: CV_RETENTION_DAYS_SETTING,
            },
        })

        if (!setting) {
            return DEFAULT_CV_RETENTION_DAYS
        }

        const days = Number(setting.value)

        if (!Number.isInteger(days) || days < 1) {
            return DEFAULT_CV_RETENTION_DAYS
        }

        return days
    }

    async updateCvRetentionDays(days: number) {
        if (!Number.isInteger(days) || days < 1 || days > 3650) {
            throw new BadRequestException(
                'CV retention days must be an integer between 1 and 3650',
            )
        }

        return this.prisma.systemSetting.upsert({
            where: {
                key: CV_RETENTION_DAYS_SETTING,
            },
            create: {
                key: CV_RETENTION_DAYS_SETTING,
                value: String(days),
            },
            update: {
                value: String(days),
            },
        })
    }
}