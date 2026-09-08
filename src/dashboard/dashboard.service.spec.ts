import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DashboardService } from './dashboard.service';
import { PrismaService } from '../database/prisma.service';

describe('DashboardService', () => {
    let service: DashboardService;

    const prisma = {
        candidate: {
            findUnique: jest.fn(),
        },
        application: {
            count: jest.fn(),
            groupBy: jest.fn(),
            findMany: jest.fn(),
        },
        job: {
            count: jest.fn(),
            findMany: jest.fn(),
        },
        match: {
            count: jest.fn(),
        },
        candidateSkill: {
            findMany: jest.fn(),
        },
        recruiter: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DashboardService,
                {
                    provide: PrismaService,
                    useValue: prisma,
                },
            ],
        }).compile();

        service = module.get<DashboardService>(DashboardService);
    });

    describe('getCandidateDashboard', () => {
        it('returns a complete candidate dashboard', async () => {
            prisma.candidate.findUnique.mockResolvedValue({
                id: 'candidate-1',
                headline: 'Backend Developer',
                summary: 'Experienced developer',
                location: 'Rotterdam',
                salaryMin: 4000,
                salaryMax: 5500,
                currency: 'EUR',
                availabilityDate: new Date('2026-10-01'),
                remotePreference: 'HYBRID',
                user: {
                    status: 'ACTIVE',
                },
            });

            prisma.application.count.mockResolvedValue(3);

            prisma.application.groupBy.mockResolvedValue([
                { status: 'PENDING', _count: { _all: 1 } },
                { status: 'ACCEPTED', _count: { _all: 1 } },
                { status: 'REJECTED', _count: { _all: 1 } },
            ]);

            prisma.application.findMany.mockResolvedValue([
                {
                    id: 'application-1',
                    status: 'PENDING',
                    createdAt: new Date('2026-09-01'),
                    job: {
                        id: 'job-1',
                        title: 'Backend Developer',
                        company: {
                            id: 'company-1',
                            name: 'Tech Company',
                        },
                    },
                },
            ]);

            prisma.job.count.mockResolvedValue(12);

            prisma.job.findMany.mockResolvedValue([
                {
                    id: 'job-1',
                    title: 'Backend Developer',
                    location: 'Rotterdam',
                    employmentType: 'FULL_TIME',
                    workMode: 'HYBRID',
                    publishedAt: new Date('2026-09-02'),
                    company: {
                        id: 'company-1',
                        name: 'Tech Company',
                    },
                },
            ]);

            prisma.match.count.mockResolvedValue(4);

            prisma.candidateSkill.findMany.mockResolvedValue([
                {
                    proficiencyLevel: 5,
                    yearsOfExperience: 4,
                    skill: {
                        id: 'skill-1',
                        name: 'TypeScript',
                        category: 'BACKEND',
                    },
                },
            ]);

            const result = await service.getCandidateDashboard('user-1');

            expect(result.profile.status).toBe('ACTIVE');
            expect(result.profile.completionPercentage).toBe(100);

            expect(result.applications.total).toBe(3);
            expect(result.applications.byStatus).toEqual({
                PENDING: 1,
                REVIEWING: 0,
                ACCEPTED: 1,
                REJECTED: 1,
                WITHDRAWN: 0,
            });

            expect(result.applications.recent).toHaveLength(1);

            expect(result.jobs.availableCount).toBe(12);
            expect(result.jobs.recommendedCount).toBe(4);
            expect(result.jobs.recent).toHaveLength(1);

            expect(result.skills.total).toBe(1);
            expect(result.skills.items).toHaveLength(1);
        });

        it('throws when candidate profile does not exist', async () => {
            prisma.candidate.findUnique.mockResolvedValue(null);

            await expect(
                service.getCandidateDashboard('unknown-user'),
            ).rejects.toThrow(NotFoundException);

            expect(prisma.application.count).not.toHaveBeenCalled();
            expect(prisma.job.count).not.toHaveBeenCalled();
        });
    });

    describe('getRecruiterDashboard', () => {
        it('returns a complete recruiter dashboard', async () => {
            prisma.recruiter.findUnique.mockResolvedValue({
                id: 'recruiter-1',
                jobTitle: 'Talent Manager',
                companyId: 'company-1',
                user: {
                    status: 'ACTIVE',
                },
                company: {
                    id: 'company-1',
                    name: 'Tech Company',
                    slug: 'tech-company',
                },
            });

            prisma.job.count
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(4)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(2);

            prisma.application.count.mockResolvedValue(7);

            prisma.application.groupBy.mockResolvedValue([
                { status: 'PENDING', _count: { _all: 2 } },
                { status: 'REVIEWING', _count: { _all: 2 } },
                { status: 'ACCEPTED', _count: { _all: 1 } },
                { status: 'REJECTED', _count: { _all: 1 } },
                { status: 'WITHDRAWN', _count: { _all: 1 } },
            ]);

            prisma.application.findMany.mockResolvedValue([
                {
                    id: 'application-1',
                    status: 'REVIEWING',
                    createdAt: new Date('2026-09-03'),
                    job: {
                        id: 'job-1',
                        title: 'Backend Developer',
                    },
                    candidate: {
                        id: 'candidate-1',
                        headline: 'Backend Developer',
                        location: 'Rotterdam',
                    },
                },
            ]);

            prisma.job.findMany.mockResolvedValue([
                {
                    id: 'job-1',
                    title: 'Backend Developer',
                    status: 'PUBLISHED',
                    publishedAt: new Date('2026-09-02'),
                    createdAt: new Date('2026-09-01'),
                },
            ]);

            const result = await service.getRecruiterDashboard('user-1');

            expect(result.profile.status).toBe('ACTIVE');
            expect(result.profile.company?.id).toBe('company-1');

            expect(result.jobs).toMatchObject({
                total: 10,
                published: 4,
                draft: 3,
                closed: 2,
            });

            expect(result.applications.total).toBe(7);

            expect(result.applications.byStatus).toEqual({
                PENDING: 2,
                REVIEWING: 2,
                ACCEPTED: 1,
                REJECTED: 1,
                WITHDRAWN: 1,
            });

            expect(result.applications.recent).toHaveLength(1);
            expect(result.jobs.recent).toHaveLength(1);
        });

        it('returns an empty dashboard when recruiter has no company', async () => {
            prisma.recruiter.findUnique.mockResolvedValue({
                id: 'recruiter-1',
                jobTitle: 'Talent Manager',
                companyId: null,
                user: {
                    status: 'ACTIVE',
                },
                company: null,
            });

            const result = await service.getRecruiterDashboard('user-1');

            expect(result.profile.company).toBeNull();
            expect(result.jobs.total).toBe(0);
            expect(result.applications.total).toBe(0);

            expect(prisma.job.count).not.toHaveBeenCalled();
            expect(prisma.application.count).not.toHaveBeenCalled();
        });

        it('throws when recruiter profile does not exist', async () => {
            prisma.recruiter.findUnique.mockResolvedValue(null);

            await expect(
                service.getRecruiterDashboard('unknown-user'),
            ).rejects.toThrow(NotFoundException);

            expect(prisma.job.count).not.toHaveBeenCalled();
            expect(prisma.application.count).not.toHaveBeenCalled();
        });
    });
});