import { Injectable, Logger } from '@nestjs/common'
import { unlink } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import {
    Cron,
    CronExpression,
} from '@nestjs/schedule'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class CvRetentionService {
    private readonly logger = new Logger(
        CvRetentionService.name,
    )

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupExpiredCvs() {
        const now = new Date()

        const candidates =
            await this.prisma.candidate.findMany({
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

        const storageRoot =
            this.getStorageRoot()

        for (const candidate of candidates) {
            if (!candidate.cvPath) {
                continue
            }

            const filePath = resolve(
                storageRoot,
                candidate.cvPath,
            )

            if (
                !filePath.startsWith(
                    `${storageRoot}${sep}`,
                )
            ) {
                this.logger.error(
                    `Invalid CV storage reference for candidate ${candidate.id}`,
                )
                continue
            }

            try {
                await unlink(filePath)
            } catch (error) {
                const code =
                    error instanceof Error &&
                        'code' in error
                        ? (error as NodeJS.ErrnoException)
                            .code
                        : undefined

                if (code !== 'ENOENT') {
                    this.logger.error(
                        `Failed to delete CV for candidate ${candidate.id}`,
                        error,
                    )
                    continue
                }
            }

            await this.prisma.candidate.update({
                where: {
                    id: candidate.id,
                },
                data: {
                    cvPath: null,
                    cvOriginalName: null,
                    cvMimeType: null,
                    cvSize: null,
                    cvExpiresAt: null,
                    cvRetentionConsent: false,
                    cvConsentAt: null,
                },
            })
        }

        if (candidates.length > 0) {
            this.logger.log(
                `Processed ${candidates.length} expired CV(s)`,
            )
        }
    }

    private getStorageRoot(): string {
        return resolve(
            process.env.CV_UPLOAD_DIR ??
            join(
                process.cwd(),
                'uploads',
            ),
        )
    }
}