import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PrismaService } from '../database/prisma.service';

describe('MatchingService', () => {
    let service: MatchingService;

    const prismaMock = {
        candidate: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
        job: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        match: {
            deleteMany: jest.fn(),
            upsert: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn(),
        },
        recruiter: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MatchingService,
                {
                    provide: PrismaService,
                    useValue: prismaMock,
                },
            ],
        }).compile();

        service = module.get<MatchingService>(MatchingService);
    });

    describe('getMyMatchForJob', () => {
        const userId = 'user-1';
        const jobId = 'job-1';

        beforeEach(() => {
            prismaMock.candidate.findUnique.mockResolvedValue({
                id: 'candidate-1',
            });

            prismaMock.job.findFirst.mockResolvedValue({
                id: jobId,
            });
        });

        it('should return the candidate match for a job', async () => {
            const match = {
                id: 'match-1',
                candidateId: 'candidate-1',
                jobId,
                overallScore: 85,
                explanation: {
                    algorithm: 'weighted-skill-v1',
                    strengths: [],
                    gaps: [],
                    requirementsCount: 2,
                },
            };

            prismaMock.match.findUnique.mockResolvedValue(match);

            const result = await service.getMyMatchForJob(userId, jobId);

            expect(result).toEqual({ data: match });
            expect(prismaMock.match.findUnique).toHaveBeenCalledWith({
                where: {
                    candidateId_jobId: {
                        candidateId: 'candidate-1',
                        jobId,
                    },
                },
            });
        });

        it('should return null when no match exists', async () => {
            prismaMock.match.findUnique.mockResolvedValue(null);

            const result = await service.getMyMatchForJob(userId, jobId);

            expect(result).toEqual({ data: null });
        });

        it('should throw when the candidate does not exist', async () => {
            prismaMock.candidate.findUnique.mockResolvedValue(null);

            await expect(
                service.getMyMatchForJob(userId, jobId),
            ).rejects.toThrow('Candidate not found');

            expect(prismaMock.job.findFirst).not.toHaveBeenCalled();
            expect(prismaMock.match.findUnique).not.toHaveBeenCalled();
        });

        it('should throw when the job is not published or has expired', async () => {
            prismaMock.job.findFirst.mockResolvedValue(null);

            await expect(
                service.getMyMatchForJob(userId, jobId),
            ).rejects.toThrow('Job not found');

            expect(prismaMock.match.findUnique).not.toHaveBeenCalled();
        });
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should calculate and save a weighted skill match', async () => {
        prismaMock.candidate.findUnique.mockResolvedValue({
            id: 'candidate-1',
            candidateSkills: [
                {
                    skillId: 'skill-1',
                    proficiencyLevel: 4,
                    skill: { name: 'TypeScript' },
                },
            ],
        });

        prismaMock.job.findMany.mockResolvedValue([
            {
                id: 'job-1',
                requirements: [
                    {
                        skillId: 'skill-1',
                        minimumLevel: 4,
                        required: true,
                        weight: null,
                        skill: { name: 'TypeScript' },
                    },
                    {
                        skillId: 'skill-2',
                        minimumLevel: 3,
                        required: false,
                        weight: null,
                        skill: { name: 'React' },
                    },
                ],
            },
        ]);

        prismaMock.match.upsert.mockResolvedValue({});

        const result: unknown = await service.recalculateCandidate('candidate-1');

        expect(result).toEqual({ calculated: 1 });

        expect(prismaMock.match.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    candidateId: 'candidate-1',
                    jobId: 'job-1',
                    overallScore: 66.67,
                    skillScore: 66.67,
                }) as Record<string, unknown>,
            }),
        );
    });

    it('should throw NotFoundException when candidate does not exist', async () => {
        prismaMock.candidate.findUnique.mockResolvedValue(null);

        await expect(
            service.recalculateCandidate('unknown-candidate'),
        ).rejects.toThrow('Candidate not found');

        expect(prismaMock.job.findMany).not.toHaveBeenCalled();
        expect(prismaMock.match.upsert).not.toHaveBeenCalled();
    });

    it('should return paginated matches for a candidate', async () => {
        const matches = [
            {
                id: 'match-1',
                overallScore: 85,
                jobId: 'job-1',
            },
        ];

        prismaMock.candidate.findUnique.mockResolvedValue({
            id: 'candidate-1',
        });

        prismaMock.match.findMany.mockResolvedValue(matches);
        prismaMock.match.count.mockResolvedValue(1);

        const result: unknown = await service.getMyMatches(
            'user-1',
            1,
            20,
        );

        expect(result).toEqual({
            data: matches,
            meta: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
            },
        });

        expect(prismaMock.match.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    candidateId: 'candidate-1',
                }) as Record<string, unknown>,
                skip: 0,
                take: 20,
            }),
        );
    });

    describe('getRecruiterJobs', () => {
        beforeEach(() => {
            prismaMock.recruiter.findUnique.mockResolvedValue({
                companyId: 'company-1',
            });

            prismaMock.job.findMany.mockResolvedValue([
                { id: 'job-1', title: 'Frontend Developer' },
                { id: 'job-2', title: 'Backend Developer' },
            ]);

            prismaMock.match.findMany.mockResolvedValue([
                { jobId: 'job-1', overallScore: 90 },
                { jobId: 'job-1', overallScore: 80 },
                { jobId: 'job-1', overallScore: 50 },
                { jobId: 'job-1', overallScore: 0 },
            ]);
        });

        it('should return published company jobs with match counts', async () => {
            const result = await service.getRecruiterJobs('recruiter-user-1');

            expect(result).toEqual({
                data: [
                    {
                        id: 'job-1',
                        title: 'Frontend Developer',
                        matchCount: 4,
                        strongMatchCount: 2,
                        partialMatchCount: 1,
                        noMatchCount: 1,
                    },
                    {
                        id: 'job-2',
                        title: 'Backend Developer',
                        matchCount: 0,
                        strongMatchCount: 0,
                        partialMatchCount: 0,
                        noMatchCount: 0,
                    },
                ],
            });

            expect(prismaMock.job.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        companyId: 'company-1',
                        status: 'PUBLISHED',
                    }) as Record<string, unknown>,
                }),
            );

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        jobId: {
                            in: ['job-1', 'job-2'],
                        },
                    },
                    select: {
                        jobId: true,
                        overallScore: true,
                    },
                }),
            );
        });

        it('should reject a recruiter without a company', async () => {
            prismaMock.recruiter.findUnique.mockResolvedValue({
                companyId: null,
            });

            await expect(
                service.getRecruiterJobs('recruiter-user-1'),
            ).rejects.toThrow('Recruiter or company not found');

            expect(prismaMock.job.findMany).not.toHaveBeenCalled();
            expect(prismaMock.match.findMany).not.toHaveBeenCalled();
        });

        it('should return an empty list when the company has no published jobs', async () => {
            prismaMock.job.findMany.mockResolvedValue([]);

            const result = await service.getRecruiterJobs('recruiter-user-1');

            expect(result).toEqual({ data: [] });
            expect(prismaMock.match.findMany).not.toHaveBeenCalled();
        });
    });

    describe('getCandidatesForJob', () => {
        beforeEach(() => {
            prismaMock.recruiter.findUnique.mockResolvedValue({
                companyId: 'company-1',
            });

            prismaMock.job.findFirst.mockResolvedValue({
                id: 'job-1',
            });

            prismaMock.match.findMany.mockResolvedValue([]);
            prismaMock.match.count.mockResolvedValue(0);
        });

        it('should return paginated candidates for a company job', async () => {
            const matches = [
                {
                    id: 'match-1',
                    overallScore: 90,
                    candidateId: 'candidate-1',
                },
            ];

            prismaMock.match.findMany.mockResolvedValue(matches);
            prismaMock.match.count.mockResolvedValue(1);

            const result: unknown = await service.getCandidatesForJob(
                'recruiter-user-1',
                'job-1',
                1,
                20,
                'all',
            );

            expect(result).toEqual({
                data: matches,
                meta: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                },
            });

            expect(prismaMock.job.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'job-1',
                        companyId: 'company-1',
                    }) as Record<string, unknown>,
                }),
            );

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { jobId: 'job-1' },
                    skip: 0,
                    take: 20,
                }),
            );

            expect(prismaMock.match.count).toHaveBeenCalledWith({
                where: { jobId: 'job-1' },
            });
        });

        it('should filter strong matches with a score of at least 80', async () => {
            await service.getCandidatesForJob(
                'recruiter-user-1',
                'job-1',
                1,
                20,
                'strong',
            );

            const expectedWhere = {
                jobId: 'job-1',
                overallScore: { gte: 80 },
            };

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedWhere }),
            );

            expect(prismaMock.match.count).toHaveBeenCalledWith({
                where: expectedWhere,
            });
        });

        it('should filter partial matches with a score above 0 and below 80', async () => {
            await service.getCandidatesForJob(
                'recruiter-user-1',
                'job-1',
                1,
                20,
                'partial',
            );

            const expectedWhere = {
                jobId: 'job-1',
                overallScore: { gt: 0, lt: 80 },
            };

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedWhere }),
            );

            expect(prismaMock.match.count).toHaveBeenCalledWith({
                where: expectedWhere,
            });
        });

        it('should filter candidates with a score of 0', async () => {
            await service.getCandidatesForJob(
                'recruiter-user-1',
                'job-1',
                1,
                20,
                'none',
            );

            const expectedWhere = {
                jobId: 'job-1',
                overallScore: { equals: 0 },
            };

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedWhere }),
            );

            expect(prismaMock.match.count).toHaveBeenCalledWith({
                where: expectedWhere,
            });
        });

        it('should return all matches without a score restriction', async () => {
            await service.getCandidatesForJob(
                'recruiter-user-1',
                'job-1',
                1,
                20,
                'all',
            );

            const expectedWhere = { jobId: 'job-1' };

            expect(prismaMock.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedWhere }),
            );

            expect(prismaMock.match.count).toHaveBeenCalledWith({
                where: expectedWhere,
            });
        });

        it('should reject a recruiter without a company', async () => {
            prismaMock.recruiter.findUnique.mockResolvedValue({
                companyId: null,
            });

            await expect(
                service.getCandidatesForJob(
                    'recruiter-user-1',
                    'job-1',
                    1,
                    20,
                ),
            ).rejects.toThrow('Recruiter or company not found');

            expect(prismaMock.job.findFirst).not.toHaveBeenCalled();
            expect(prismaMock.match.findMany).not.toHaveBeenCalled();
        });

        it('should reject a job that does not belong to the recruiter company', async () => {
            prismaMock.job.findFirst.mockResolvedValue(null);

            await expect(
                service.getCandidatesForJob(
                    'recruiter-user-1',
                    'job-2',
                    1,
                    20,
                ),
            ).rejects.toThrow('Job not found');

            expect(prismaMock.job.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 'job-2',
                        companyId: 'company-1',
                    }) as Record<string, unknown>,
                }),
            );

            expect(prismaMock.match.findMany).not.toHaveBeenCalled();
        });
    });
});
