import { Injectable, Logger } from '@nestjs/common'
import { unlink } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class CvRetentionService {
    private readonly logger = new Logger(CvRetentionService.name)

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupExpiredCvs() {
        const now = new Date()

        const applications = await this.prisma.application.findMany({
            where: {
                cvExpiresAt: {
                    lte: now,
                },
                cvPath: {
                    not: null,
                },
            },
            select: {
                id: true,
                cvPath: true,
            },
        })

        for (const application of applications) {
            if (!application.cvPath) {
                continue
            }

            const storageRoot = this.getStorageRoot()
            const filePath = resolve(storageRoot, application.cvPath)

            if (!filePath.startsWith(`${storageRoot}${sep}`)) {
                this.logger.error(
                    `Invalid CV storage reference for application ${application.id}`,
                )
                continue
            }

            try {
                await unlink(filePath)
            } catch (error) {
                const code =
                    error instanceof Error && 'code' in error
                        ? (error as NodeJS.ErrnoException).code
                        : undefined

                if (code !== 'ENOENT') {
                    this.logger.error(
                        `Failed to delete CV for application ${application.id}`,
                        error,
                    )
                    continue
                }
            }

            await this.prisma.application.update({
                where: {
                    id: application.id,
                },
                data: {
                    cvPath: null,
                    cvOriginalName: null,
                    cvMimeType: null,
                    cvSize: null,
                },
            })
        }

        if (applications.length > 0) {
            this.logger.log(
                `Processed ${applications.length} expired CV(s)`,
            )
        }
    }

    private getStorageRoot(): string {
        return resolve(
            process.env.CV_UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
        )
    }
}