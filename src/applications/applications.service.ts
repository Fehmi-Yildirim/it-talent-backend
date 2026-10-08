import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common'
import { createReadStream } from 'node:fs'
import type { Readable } from 'node:stream'
import { basename, join, resolve, sep } from 'node:path'
import {
    ApplicationStatus,
    JobStatus,
} from '../../generated/prisma/enums'
import { PrismaService } from '../database/prisma.service'
import { CreateApplicationDto } from './dto/create-application.dto'

@Injectable()
export class ApplicationsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async create(
        candidateUserId: string,
        jobId: string,
        dto: CreateApplicationDto,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
            select: {
                id: true,
                cvPath: true,
                cvOriginalName: true,
                cvMimeType: true,
                cvSize: true,
                cvExpiresAt: true,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can apply for jobs',
            )
        }

        if (!this.hasValidCv(candidate)) {
            throw new ConflictException(
                'A valid CV is required before applying for this job',
            )
        }

        const job = await this.prisma.job.findUnique({
            where: {
                id: jobId,
            },
            select: {
                id: true,
                status: true,
                expiresAt: true,
            },
        })

        if (!job) {
            throw new NotFoundException('Job not found')
        }

        if (job.status !== JobStatus.PUBLISHED) {
            throw new ConflictException(
                'This job is not available for applications',
            )
        }

        if (
            job.expiresAt &&
            job.expiresAt <= new Date()
        ) {
            throw new ConflictException(
                'This job has expired',
            )
        }

        const existingApplication =
            await this.prisma.application.findUnique({
                where: {
                    candidateId_jobId: {
                        candidateId: candidate.id,
                        jobId: job.id,
                    },
                },
            })

        if (
            existingApplication &&
            existingApplication.status !==
            ApplicationStatus.WITHDRAWN
        ) {
            throw new ConflictException(
                'You have already applied for this job',
            )
        }

        if (existingApplication) {
            const updatedApplication =
                await this.prisma.application.update({
                    where: {
                        id: existingApplication.id,
                    },
                    data: {
                        coverLetter: dto.coverLetter,
                        status: ApplicationStatus.PENDING,
                    },
                })

            return this.withCvUrl(
                updatedApplication,
                true,
                candidate.cvExpiresAt,
            )
        }

        const application =
            await this.prisma.application.create({
                data: {
                    candidateId: candidate.id,
                    jobId: job.id,
                    coverLetter: dto.coverLetter,
                    status: ApplicationStatus.PENDING,
                },
            })

        return this.withCvUrl(
            application,
            true,
            candidate.cvExpiresAt,
        )
    }

    async findAll(candidateUserId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
            select: {
                id: true,
                cvPath: true,
                cvExpiresAt: true,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can view applications',
            )
        }

        const applications =
            await this.prisma.application.findMany({
                where: {
                    candidateId: candidate.id,
                },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            location: true,
                            employmentType: true,
                            workMode: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })

        return applications.map((application) =>
            this.withCvUrl(
                application,
                Boolean(candidate.cvPath),
                candidate.cvExpiresAt,
            ),
        )
    }

    async findOne(
        candidateUserId: string,
        applicationId: string,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
            select: {
                id: true,
                cvPath: true,
                cvExpiresAt: true,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can view applications',
            )
        }

        const application =
            await this.prisma.application.findUnique({
                where: {
                    id: applicationId,
                },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            location: true,
                            employmentType: true,
                            workMode: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                },
            })

        if (!application) {
            throw new NotFoundException(
                'Application not found',
            )
        }

        if (
            application.candidateId !==
            candidate.id
        ) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return this.withCvUrl(
            application,
            Boolean(candidate.cvPath),
            candidate.cvExpiresAt,
        )
    }

    async withdraw(
        candidateUserId: string,
        applicationId: string,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
            select: {
                id: true,
                cvPath: true,
                cvExpiresAt: true,
            },
        })

        if (!candidate) {
            throw new ForbiddenException(
                'Only candidates can withdraw applications',
            )
        }

        const application =
            await this.prisma.application.findUnique({
                where: {
                    id: applicationId,
                },
            })

        if (!application) {
            throw new NotFoundException(
                'Application not found',
            )
        }

        if (
            application.candidateId !==
            candidate.id
        ) {
            throw new ForbiddenException(
                'You are not allowed to withdraw this application',
            )
        }

        if (
            application.status !==
            ApplicationStatus.PENDING &&
            application.status !==
            ApplicationStatus.REVIEWING
        ) {
            throw new ConflictException(
                'This application cannot be withdrawn',
            )
        }

        const updatedApplication =
            await this.prisma.application.update({
                where: {
                    id: application.id,
                },
                data: {
                    status: ApplicationStatus.WITHDRAWN,
                },
            })

        return this.withCvUrl(
            updatedApplication,
            Boolean(candidate.cvPath),
            candidate.cvExpiresAt,
        )
    }

    async findAllForRecruiter(
        recruiterUserId: string,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can view applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const applications =
            await this.prisma.application.findMany({
                where: {
                    job: {
                        companyId: recruiter.companyId,
                    },
                },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                    candidate: {
                        select: {
                            id: true,
                            headline: true,
                            summary: true,
                            location: true,
                            cvPath: true,
                            cvExpiresAt: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })

        return applications.map((application) =>
            this.withCvUrl(
                application,
                Boolean(application.candidate.cvPath),
                application.candidate.cvExpiresAt,
            ),
        )
    }

    async findOneForRecruiter(
        recruiterUserId: string,
        applicationId: string,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can view applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const application =
            await this.prisma.application.findUnique({
                where: {
                    id: applicationId,
                },
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            companyId: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                },
                            },
                        },
                    },
                    candidate: {
                        select: {
                            id: true,
                            headline: true,
                            summary: true,
                            location: true,
                            cvPath: true,
                            cvExpiresAt: true,
                        },
                    },
                },
            })

        if (!application) {
            throw new NotFoundException(
                'Application not found',
            )
        }

        if (
            application.job.companyId !==
            recruiter.companyId
        ) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return this.withCvUrl(
            application,
            Boolean(application.candidate.cvPath),
            application.candidate.cvExpiresAt,
        )
    }

    async getCv(
        userId: string,
        applicationId: string,
    ): Promise<{
        stream: Readable
        mimeType: string
        originalName: string
    }> {
        const application =
            await this.prisma.application.findUnique({
                where: {
                    id: applicationId,
                },
                include: {
                    job: {
                        select: {
                            companyId: true,
                        },
                    },
                    candidate: {
                        select: {
                            id: true,
                            cvPath: true,
                            cvMimeType: true,
                            cvOriginalName: true,
                            cvExpiresAt: true,
                        },
                    },
                },
            })

        if (!application) {
            throw new NotFoundException(
                'Application not found',
            )
        }

        const [candidate, recruiter] =
            await Promise.all([
                this.prisma.candidate.findUnique({
                    where: {
                        userId,
                    },
                    select: {
                        id: true,
                    },
                }),
                this.prisma.recruiter.findUnique({
                    where: {
                        userId,
                    },
                    select: {
                        companyId: true,
                    },
                }),
            ])

        const canAccess =
            candidate?.id ===
            application.candidateId ||
            recruiter?.companyId ===
            application.job.companyId

        if (!canAccess) {
            throw new ForbiddenException(
                'You are not allowed to access this CV',
            )
        }

        if (
            !application.candidate.cvPath ||
            !application.candidate.cvMimeType ||
            !application.candidate.cvOriginalName
        ) {
            throw new NotFoundException(
                'CV not found',
            )
        }

        if (
            application.candidate.cvExpiresAt &&
            application.candidate.cvExpiresAt <=
            new Date()
        ) {
            throw new NotFoundException(
                'CV not found',
            )
        }

        const storageRoot =
            this.getStorageRoot()

        const filePath = resolve(
            storageRoot,
            application.candidate.cvPath,
        )

        if (
            !filePath.startsWith(
                `${storageRoot}${sep}`,
            )
        ) {
            throw new InternalServerErrorException(
                'Invalid CV storage reference',
            )
        }

        return {
            stream: createReadStream(filePath),
            mimeType:
                application.candidate.cvMimeType,
            originalName: basename(
                application.candidate
                    .cvOriginalName,
            ),
        }
    }

    async updateStatus(
        recruiterUserId: string,
        applicationId: string,
        status: ApplicationStatus,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can manage applications',
            )
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException(
                'Recruiter is not associated with a company',
            )
        }

        const application =
            await this.prisma.application.findUnique({
                where: {
                    id: applicationId,
                },
                include: {
                    job: {
                        select: {
                            companyId: true,
                        },
                    },
                },
            })

        if (!application) {
            throw new NotFoundException(
                'Application not found',
            )
        }

        if (
            application.job.companyId !==
            recruiter.companyId
        ) {
            throw new ForbiddenException(
                'You are not allowed to manage this application',
            )
        }

        if (
            !this.isValidStatusTransition(
                application.status,
                status,
            )
        ) {
            throw new BadRequestException(
                `Cannot change application status from ${application.status} to ${status}`,
            )
        }

        const updatedApplication =
            await this.prisma.application.update({
                where: {
                    id: application.id,
                },
                data: {
                    status,
                },
            })

        const candidate =
            await this.prisma.candidate.findUnique({
                where: {
                    id: application.candidateId,
                },
                select: {
                    cvPath: true,
                    cvExpiresAt: true,
                },
            })

        return this.withCvUrl(
            updatedApplication,
            Boolean(candidate?.cvPath),
            candidate?.cvExpiresAt ?? null,
        )
    }

    private hasValidCv(candidate: {
        cvPath: string | null
        cvOriginalName: string | null
        cvMimeType: string | null
        cvSize: number | null
        cvExpiresAt: Date | null
    }): boolean {
        return Boolean(
            candidate.cvPath &&
            candidate.cvOriginalName &&
            candidate.cvMimeType &&
            candidate.cvSize &&
            (
                !candidate.cvExpiresAt ||
                candidate.cvExpiresAt > new Date()
            ),
        )
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

    private withCvUrl<
        T extends {
            id: string
        },
    >(
        application: T,
        hasCv: boolean,
        cvExpiresAt: Date | null | undefined,
    ) {
        const cvIsAvailable =
            hasCv &&
            (
                !cvExpiresAt ||
                cvExpiresAt > new Date()
            )

        // CV metadata belongs to the candidate record and must not be
        // exposed as application fields. Keep only the derived download URL.
        const publicApplication = { ...application } as T &
            Record<string, unknown>
        for (const field of [
            'cvPath',
            'cvOriginalName',
            'cvMimeType',
            'cvSize',
            'cvExpiresAt',
            'cvRetentionConsent',
            'cvConsentAt',
        ]) {
            delete publicApplication[field]
        }

        return {
            ...publicApplication,
            cvUrl: cvIsAvailable
                ? `/api/v1/applications/${application.id}/cv`
                : null,
        }
    }

    private isValidStatusTransition(
        currentStatus: ApplicationStatus,
        nextStatus: ApplicationStatus,
    ): boolean {
        const transitions: Record<
            ApplicationStatus,
            ApplicationStatus[]
        > = {
            [ApplicationStatus.PENDING]: [
                ApplicationStatus.REVIEWING,
                ApplicationStatus.REJECTED,
            ],
            [ApplicationStatus.REVIEWING]: [
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.REJECTED,
            ],
            [ApplicationStatus.ACCEPTED]: [],
            [ApplicationStatus.REJECTED]: [],
            [ApplicationStatus.WITHDRAWN]: [],
        }

        return transitions[
            currentStatus
        ].includes(nextStatus)
    }
}
