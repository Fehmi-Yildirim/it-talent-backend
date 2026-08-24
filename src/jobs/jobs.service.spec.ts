import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
    let service: JobsService;

    const prisma = {
        recruiter: {
            findUnique: jest.fn(),
        },
        skill: {
            findMany: jest.fn(),
        },
        job: {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule =
            await Test.createTestingModule({
                providers: [
                    JobsService,
                    {
                        provide: PrismaService,
                        useValue: prisma,
                    },
                ],
            }).compile();

        service = module.get<JobsService>(JobsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // Test successful job creation
    it('should create a draft job for the recruiter company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        prisma.skill.findMany.mockResolvedValue([]);

        prisma.job.create.mockResolvedValue({
            id: 'job-id',
            companyId: 'company-id',
            createdByRecruiterId: 'recruiter-id',
            status: 'DRAFT',
        });

        const result = await service.create('user-id', {
            title: 'Backend Developer',
            description:
                'Build and maintain backend services.',
            employmentType: 'FULL_TIME',
            workMode: 'REMOTE',
        });

        expect(prisma.recruiter.findUnique).toHaveBeenCalledWith({
            where: {
                userId: 'user-id',
            },
            select: {
                id: true,
                companyId: true,
            },
        });

        expect(prisma.job.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    companyId: 'company-id',
                    createdByRecruiterId: 'recruiter-id',
                    status: 'DRAFT',
                    title: 'Backend Developer',
                }),
            }),
        );

        expect(result).toEqual({
            id: 'job-id',
            companyId: 'company-id',
            createdByRecruiterId: 'recruiter-id',
            status: 'DRAFT',
        });
    });

    // Test recruiter authorization
    it('should reject users who are not recruiters', async () => {
        prisma.recruiter.findUnique.mockResolvedValue(null);

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
            }),
        ).rejects.toThrow(
            'Only recruiters can create jobs',
        );

        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test recruiter company assignment
    it('should reject a recruiter without a company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: null,
        });

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
            }),
        ).rejects.toThrow(
            'Recruiter is not assigned to a company',
        );

        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test salary range validation
    it('should reject an invalid salary range', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 6000,
                salaryMax: 5000,
            }),
        ).rejects.toThrow(
            'salaryMax cannot be lower than salaryMin',
        );

        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test skill validation
    it('should reject unknown skills', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        prisma.skill.findMany.mockResolvedValue([]);

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                requiredSkillIds: [
                    '11111111-1111-4111-8111-111111111111',
                ],
            }),
        ).rejects.toThrow(
            'One or more skills do not exist',
        );

        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test required and preferred skill separation
    it('should reject a skill that is both required and preferred', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        const skillId =
            '11111111-1111-4111-8111-111111111111';

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                requiredSkillIds: [skillId],
                preferredSkillIds: [skillId],
            }),
        ).rejects.toThrow(
            'A skill cannot be both required and preferred',
        );

        expect(prisma.skill.findMany).not.toHaveBeenCalled();
        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test company ownership when retrieving jobs
    it('should return jobs belonging only to the recruiter company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        const jobs = [
            {
                id: 'job-1',
                companyId: 'company-a',
                title: 'Backend Developer',
            },
            {
                id: 'job-2',
                companyId: 'company-a',
                title: 'Frontend Developer',
            },
        ];

        prisma.job.findMany.mockResolvedValue(jobs);

        const result = await service.getAll('user-a');

        expect(prisma.recruiter.findUnique).toHaveBeenCalledWith({
            where: {
                userId: 'user-a',
            },
            select: {
                companyId: true,
            },
        });

        expect(prisma.job.findMany).toHaveBeenCalledWith({
            where: {
                companyId: 'company-a',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        expect(result).toEqual(jobs);
    });

    // Test non-recruiter authorization when retrieving jobs
    it('should reject users who are not recruiters when retrieving jobs', async () => {
        prisma.recruiter.findUnique.mockResolvedValue(null);

        await expect(
            service.getAll('user-id'),
        ).rejects.toThrow(
            'Only recruiters can access jobs',
        );

        expect(prisma.job.findMany).not.toHaveBeenCalled();
    });

    // Test recruiter company assignment when retrieving jobs
    it('should reject a recruiter without a company when retrieving jobs', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: null,
        });

        await expect(
            service.getAll('user-id'),
        ).rejects.toThrow(
            'Recruiter is not assigned to a company',
        );

        expect(prisma.job.findMany).not.toHaveBeenCalled();
    });

    // Test company ownership when retrieving a single job
    it('should return a job belonging to the recruiter company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        const job = {
            id: 'job-1',
            companyId: 'company-a',
            title: 'Backend Developer',
        };

        prisma.job.findFirst.mockResolvedValue(job);

        const result = await service.getById(
            'user-a',
            'job-1',
        );

        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                companyId: 'company-a',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });

        expect(result).toEqual(job);
    });

    // Test company ownership when retrieving a single job
    it('should not return a job belonging to another company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue(null);

        await expect(
            service.getById(
                'user-a',
                'job-from-company-b',
            ),
        ).rejects.toThrow('Job not found');

        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'job-from-company-b',
                companyId: 'company-a',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    });

    // Test non-recruiter authorization when retrieving a single job
    it('should reject non-recruiters when retrieving a job', async () => {
        prisma.recruiter.findUnique.mockResolvedValue(null);

        await expect(
            service.getById('user-id', 'job-id'),
        ).rejects.toThrow(
            'Only recruiters can access jobs',
        );

        expect(prisma.job.findFirst).not.toHaveBeenCalled();
    });

    // Test recruiter company assignment when retrieving a single job
    it('should reject a recruiter without a company when retrieving a job', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: null,
        });

        await expect(
            service.getById('user-id', 'job-id'),
        ).rejects.toThrow(
            'Recruiter is not assigned to a company',
        );

        expect(prisma.job.findFirst).not.toHaveBeenCalled();
    });

    // Test successful job update
    it('should update a job belonging to the recruiter company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
            salaryMin: 4000,
            salaryMax: 6000,
        });

        prisma.job.update.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
            title: 'Senior Backend Developer',
        });

        const result = await service.update(
            'user-a',
            'job-1',
            {
                title: 'Senior Backend Developer',
            },
        );

        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                companyId: 'company-a',
            },
            select: {
                id: true,
                companyId: true,
                salaryMin: true,
                salaryMax: true,
            },
        });

        expect(prisma.job.update).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                title: 'Senior Backend Developer',
            },
        });

        expect(result).toEqual({
            id: 'job-1',
            companyId: 'company-a',
            title: 'Senior Backend Developer',
        });
    });

    // Test company ownership during job update
    it('should reject updating a job belonging to another company', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue(null);

        await expect(
            service.update(
                'user-a',
                'job-from-company-b',
                {
                    title: 'Updated Job',
                },
            ),
        ).rejects.toThrow('Job not found');

        expect(prisma.job.update).not.toHaveBeenCalled();
    });

    // Test non-recruiter authorization during job update
    it('should reject non-recruiters when updating a job', async () => {
        prisma.recruiter.findUnique.mockResolvedValue(null);

        await expect(
            service.update(
                'user-id',
                'job-id',
                {
                    title: 'Updated Job',
                },
            ),
        ).rejects.toThrow(
            'Only recruiters can update jobs',
        );

        expect(prisma.job.findFirst).not.toHaveBeenCalled();
        expect(prisma.job.update).not.toHaveBeenCalled();
    });

    // Test recruiter company assignment during job update
    it('should reject a recruiter without a company when updating a job', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: null,
        });

        await expect(
            service.update(
                'user-id',
                'job-id',
                {
                    title: 'Updated Job',
                },
            ),
        ).rejects.toThrow(
            'Recruiter is not assigned to a company',
        );

        expect(prisma.job.findFirst).not.toHaveBeenCalled();
        expect(prisma.job.update).not.toHaveBeenCalled();
    });

    // Test salary range validation during job update
    it('should reject an invalid salary range when updating a job', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
            salaryMin: 4000,
            salaryMax: 6000,
        });

        await expect(
            service.update(
                'user-a',
                'job-1',
                {
                    salaryMin: 7000,
                    salaryMax: 5000,
                },
            ),
        ).rejects.toThrow(
            'salaryMax cannot be lower than salaryMin',
        );

        expect(prisma.job.update).not.toHaveBeenCalled();
    });

    // Test duplicate required skills
    it('should reject duplicate required skills', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        const skillId =
            '11111111-1111-4111-8111-111111111111';

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                requiredSkillIds: [
                    skillId,
                    skillId,
                ],
            }),
        ).rejects.toThrow(
            'A skill cannot be added to a job more than once',
        );

        expect(prisma.skill.findMany).not.toHaveBeenCalled();
        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    // Test duplicate preferred skills
    it('should reject duplicate preferred skills', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            id: 'recruiter-id',
            companyId: 'company-id',
        });

        const skillId =
            '11111111-1111-4111-8111-111111111111';

        await expect(
            service.create('user-id', {
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                preferredSkillIds: [
                    skillId,
                    skillId,
                ],
            }),
        ).rejects.toThrow(
            'A skill cannot be added to a job more than once',
        );

        expect(prisma.skill.findMany).not.toHaveBeenCalled();
        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it('should replace job requirements during update', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
            salaryMin: 4000,
            salaryMax: 6000,
        });

        prisma.skill.findMany.mockResolvedValue([
            { id: 'skill-required' },
            { id: 'skill-preferred' },
        ]);

        prisma.job.update.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
        });

        await service.update('user-a', 'job-1', {
            requiredSkillIds: ['skill-required'],
            preferredSkillIds: ['skill-preferred'],
        });

        expect(prisma.job.update).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                requirements: {
                    deleteMany: {},
                    create: [
                        {
                            skillId: 'skill-required',
                            required: true,
                            minimumLevel: 1,
                        },
                        {
                            skillId: 'skill-preferred',
                            required: false,
                            minimumLevel: 1,
                        },
                    ],
                },
            },
        });
    });

    it('should remove all job requirements when empty skill arrays are provided', async () => {
        prisma.recruiter.findUnique.mockResolvedValue({
            companyId: 'company-a',
        });

        prisma.job.findFirst.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
            salaryMin: 4000,
            salaryMax: 6000,
        });

        prisma.job.update.mockResolvedValue({
            id: 'job-1',
            companyId: 'company-a',
        });

        await service.update('user-a', 'job-1', {
            requiredSkillIds: [],
            preferredSkillIds: [],
        });

        expect(prisma.job.update).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
            },
            data: {
                requirements: {
                    deleteMany: {},
                    create: [],
                },
            },
        });
    });

});