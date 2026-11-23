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

        const result = await service.recalculateCandidate('candidate-1');

        expect(result).toEqual({ calculated: 1 });

        expect(prismaMock.match.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    candidateId: 'candidate-1',
                    jobId: 'job-1',
                    overallScore: 66.67,
                    skillScore: 66.67,
                }),
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

        const result = await service.getMyMatches(
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
                }),
                skip: 0,
                take: 20,
            }),
        );
    });

    it('should return paginated candidates for a company job', async () => {
        const matches = [
            {
                id: 'match-1',
                overallScore: 90,
                candidateId: 'candidate-1',
            },
        ];

        prismaMock.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-1',
        });

        prismaMock.job.findFirst.mockResolvedValue({
            id: 'job-1',
        });

        prismaMock.match.findMany.mockResolvedValue(matches);
        prismaMock.match.count.mockResolvedValue(1);

        const result = await service.getCandidatesForJob(
            'recruiter-user-1',
            'job-1',
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

        expect(prismaMock.job.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'job-1',
                    companyId: 'company-1',
                }),
            }),
        );

        expect(prismaMock.match.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { jobId: 'job-1' },
                skip: 0,
                take: 20,
            }),
        );
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
        prismaMock.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-1',
        });

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
                }),
            }),
        );

        expect(prismaMock.match.findMany).not.toHaveBeenCalled();
    });
});
