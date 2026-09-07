import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { ApplicationStatus, JobStatus } from '../../generated/prisma/enums'
import { PrismaService } from '../database/prisma.service'
import { CreateApplicationDto } from './dto/create-application.dto'

@Injectable()
export class ApplicationsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(candidateUserId: string, jobId: string, dto: CreateApplicationDto) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException('Only candidates can apply for jobs')
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
            throw new ConflictException('This job is not available for applications')
        }

        if (job.expiresAt && job.expiresAt <= new Date()) {
            throw new ConflictException('This job has expired')
        }

        const existingApplication = await this.prisma.application.findUnique({
            where: {
                candidateId_jobId: {
                    candidateId: candidate.id,
                    jobId: job.id,
                },
            },
        })

        if (existingApplication) {
            throw new ConflictException(
                'You have already applied for this job',
            )
        }

        return this.prisma.application.create({
            data: {
                candidateId: candidate.id,
                jobId: job.id,
                coverLetter: dto.coverLetter,
                status: ApplicationStatus.PENDING,
            },
        })
    }

    async findAll(candidateUserId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException('Only candidates can view applications')
        }

        return this.prisma.application.findMany({
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
    }

    async findOne(candidateUserId: string, applicationId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException('Only candidates can view applications')
        }

        const application = await this.prisma.application.findUnique({
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
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return application
    }

    async withdraw(candidateUserId: string, applicationId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId: candidateUserId,
            },
        })

        if (!candidate) {
            throw new ForbiddenException('Only candidates can withdraw applications')
        }

        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.candidateId !== candidate.id) {
            throw new ForbiddenException(
                'You are not allowed to withdraw this application',
            )
        }

        if (
            application.status !== ApplicationStatus.PENDING &&
            application.status !== ApplicationStatus.REVIEWING
        ) {
            throw new ConflictException(
                'This application cannot be withdrawn',
            )
        }

        return this.prisma.application.update({
            where: {
                id: application.id,
            },
            data: {
                status: ApplicationStatus.WITHDRAWN,
            },
        })
    }

    async findAllForRecruiter(recruiterUserId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId: recruiterUserId,
            },
            select: {
                id: true,
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can view applications')
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException('Recruiter is not associated with a company')
        }

        return this.prisma.application.findMany({
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
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        })
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
                id: true,
                companyId: true,
            },
        })

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can view applications')
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException('Recruiter is not associated with a company')
        }

        const application = await this.prisma.application.findUnique({
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
                    },
                },
            },
        })

        if (!application) {
            throw new NotFoundException('Application not found')
        }

        if (application.job.companyId !== recruiter.companyId) {
            throw new ForbiddenException(
                'You are not allowed to view this application',
            )
        }

        return application
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
            throw new ForbiddenException('Only recruiters can manage applications')
        }

        if (!recruiter.companyId) {
            throw new ForbiddenException('Recruiter is not associated with a company')
        }

        const application = await this.prisma.application.findUnique({
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
            throw new NotFoundException('Application not found')
        }

        if (application.job.companyId !== recruiter.companyId) {
            throw new ForbiddenException(
                'You are not allowed to manage this application',
            )
        }

        if (!this.isValidStatusTransition(application.status, status)) {
            throw new BadRequestException(
                `Cannot change application status from ${application.status} to ${status}`,
            )
        }

        return this.prisma.application.update({
            where: {
                id: application.id,
            },
            data: {
                status,
            },
        })
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

        return transitions[currentStatus].includes(nextStatus)
    }
}
