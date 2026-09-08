import { Injectable, NotFoundException } from '@nestjs/common';

import {
    ApplicationStatus,
    JobStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';

const RECENT_LIMIT = 5;

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getCandidateDashboard(userId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: {
                id: true,
                headline: true,
                summary: true,
                location: true,
                salaryMin: true,
                salaryMax: true,
                currency: true,
                availabilityDate: true,
                remotePreference: true,
                user: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate profile not found');
        }

        const [
            totalApplications,
            applicationStatusCounts,
            recentApplications,
            availableJobsCount,
            recentJobs,
            recommendedJobsCount,
            skills,
        ] = await Promise.all([
            this.prisma.application.count({
                where: {
                    candidateId: candidate.id,
                },
            }),

            this.prisma.application.groupBy({
                by: ['status'],
                where: {
                    candidateId: candidate.id,
                },
                _count: {
                    _all: true,
                },
            }),

            this.prisma.application.findMany({
                where: {
                    candidateId: candidate.id,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: RECENT_LIMIT,
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    job: {
                        select: {
                            id: true,
                            title: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            }),

            this.prisma.job.count({
                where: {
                    status: JobStatus.PUBLISHED,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
            }),

            this.prisma.job.findMany({
                where: {
                    status: JobStatus.PUBLISHED,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
                orderBy: {
                    publishedAt: 'desc',
                },
                take: RECENT_LIMIT,
                select: {
                    id: true,
                    title: true,
                    location: true,
                    employmentType: true,
                    workMode: true,
                    publishedAt: true,
                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),

            this.prisma.match.count({
                where: {
                    candidateId: candidate.id,
                    job: {
                        status: JobStatus.PUBLISHED,
                        OR: [
                            { expiresAt: null },
                            { expiresAt: { gt: new Date() } },
                        ],
                    },
                },
            }),

            this.prisma.candidateSkill.findMany({
                where: {
                    candidateId: candidate.id,
                },
                orderBy: {
                    proficiencyLevel: 'desc',
                },
                select: {
                    proficiencyLevel: true,
                    yearsOfExperience: true,
                    skill: {
                        select: {
                            id: true,
                            name: true,
                            category: true,
                        },
                    },
                },
            }),
        ]);

        const completionFields = [
            candidate.headline,
            candidate.summary,
            candidate.location,
            candidate.salaryMin,
            candidate.salaryMax,
            candidate.currency,
            candidate.availabilityDate,
            candidate.remotePreference,
        ];

        const completedFields = completionFields.filter(
            (value) => value !== null && value !== undefined && value !== '',
        ).length;

        const profileCompletion = Math.round(
            (completedFields / completionFields.length) * 100,
        );

        const applicationsByStatus = Object.fromEntries(
            Object.values(ApplicationStatus).map((status) => [
                status,
                applicationStatusCounts.find((item) => item.status === status)?._count
                    ._all ?? 0,
            ]),
        );

        return {
            profile: {
                status: candidate.user.status,
                completionPercentage: profileCompletion,
                headline: candidate.headline,
                summary: candidate.summary,
                location: candidate.location,
                salaryMin: candidate.salaryMin,
                salaryMax: candidate.salaryMax,
                currency: candidate.currency,
                availabilityDate: candidate.availabilityDate,
                remotePreference: candidate.remotePreference,
            },
            applications: {
                total: totalApplications,
                byStatus: applicationsByStatus,
                recent: recentApplications,
            },
            jobs: {
                recommendedCount: recommendedJobsCount,
                availableCount: availableJobsCount,
                recent: recentJobs,
            },
            skills: {
                total: skills.length,
                items: skills,
            },
        };
    }

    async getRecruiterDashboard(userId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: { userId },
            select: {
                id: true,
                jobTitle: true,
                companyId: true,
                user: {
                    select: {
                        status: true,
                    },
                },
                company: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        if (!recruiter) {
            throw new NotFoundException('Recruiter profile not found');
        }

        if (!recruiter.companyId) {
            return {
                profile: {
                    status: recruiter.user.status,
                    jobTitle: recruiter.jobTitle,
                    company: null,
                },
                jobs: {
                    total: 0,
                    published: 0,
                    draft: 0,
                    closed: 0,
                    recent: [],
                },
                applications: {
                    total: 0,
                    byStatus: Object.fromEntries(
                        Object.values(ApplicationStatus).map((status) => [status, 0]),
                    ),
                    recent: [],
                },
            };
        }

        const [
            totalJobs,
            publishedJobs,
            draftJobs,
            closedJobs,
            totalApplications,
            applicationStatusCounts,
            recentApplications,
            recentJobs,
        ] = await Promise.all([
            this.prisma.job.count({
                where: {
                    companyId: recruiter.companyId,
                },
            }),

            this.prisma.job.count({
                where: {
                    companyId: recruiter.companyId,
                    status: JobStatus.PUBLISHED,
                },
            }),

            this.prisma.job.count({
                where: {
                    companyId: recruiter.companyId,
                    status: JobStatus.DRAFT,
                },
            }),

            this.prisma.job.count({
                where: {
                    companyId: recruiter.companyId,
                    status: JobStatus.CLOSED,
                },
            }),

            this.prisma.application.count({
                where: {
                    job: {
                        companyId: recruiter.companyId,
                    },
                },
            }),

            this.prisma.application.groupBy({
                by: ['status'],
                where: {
                    job: {
                        companyId: recruiter.companyId,
                    },
                },
                _count: {
                    _all: true,
                },
            }),

            this.prisma.application.findMany({
                where: {
                    job: {
                        companyId: recruiter.companyId,
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: RECENT_LIMIT,
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    job: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    candidate: {
                        select: {
                            id: true,
                            headline: true,
                            location: true,
                        },
                    },
                },
            }),

            this.prisma.job.findMany({
                where: {
                    companyId: recruiter.companyId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: RECENT_LIMIT,
                select: {
                    id: true,
                    title: true,
                    status: true,
                    publishedAt: true,
                    createdAt: true,
                },
            }),
        ]);

        const applicationsByStatus = Object.fromEntries(
            Object.values(ApplicationStatus).map((status) => [
                status,
                applicationStatusCounts.find((item) => item.status === status)?._count
                    ._all ?? 0,
            ]),
        );

        return {
            profile: {
                status: recruiter.user.status,
                jobTitle: recruiter.jobTitle,
                company: recruiter.company,
            },
            jobs: {
                total: totalJobs,
                published: publishedJobs,
                draft: draftJobs,
                closed: closedJobs,
                recent: recentJobs,
            },
            applications: {
                total: totalApplications,
                byStatus: applicationsByStatus,
                recent: recentApplications,
            },
        };
    }
}