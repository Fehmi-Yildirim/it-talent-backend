
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { JobsService } from './jobs.service';

interface RecruiterRecord {
  id?: string;
  companyId: string | null;
}

interface SkillRecord {
  id: string;
}

interface JobRecord {
  id: string;
  companyId?: string;
  createdByRecruiterId?: string;
  status?: string;
  title?: string;
  description?: string;
  salaryMin?: unknown;
  salaryMax?: unknown;
  publishedAt?: Date | null;
}

interface ServiceJobResult extends JobRecord {
  companyId: string;
  createdByRecruiterId?: string;
  status: string;
}

interface JobRequirementRecord {
  id: string;
  jobId: string;
  skillId: string;
  required?: boolean;
  minimumLevel?: number;
  skill?: {
    id: string;
    name: string;
  };
}

interface TransactionClient {
  jobRequirement: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
}

interface DiscoveryResult {
  items: JobRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MessageResult {
  message: string;
}

async function serviceResult<T>(operation: () => unknown): Promise<T> {
  const value = await operation();

  return value as T;
}

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
      count: jest.fn(),
      update: jest.fn(),
    },

    jobRequirement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
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

  it('should create a draft job for the recruiter company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    prisma.skill.findMany.mockResolvedValue([]);

    prisma.job.create.mockResolvedValue({
      id: 'job-id',
      companyId: 'company-id',
      createdByRecruiterId: 'recruiter-id',
      status: 'DRAFT',
    } satisfies JobRecord);

    const result = await serviceResult<ServiceJobResult>(() =>
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
      }),
    );

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

  it('should reject users who are not recruiters', async () => {
    prisma.recruiter.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
      }),
    ).rejects.toThrow('Only recruiters can create jobs');

    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should reject a recruiter without a company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: null,
    } satisfies RecruiterRecord);

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
      }),
    ).rejects.toThrow('Recruiter is not assigned to a company');

    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should reject an invalid salary range', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        salaryMin: 6000,
        salaryMax: 5000,
      }),
    ).rejects.toThrow('salaryMax cannot be lower than salaryMin');

    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should reject unknown skills', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    prisma.skill.findMany.mockResolvedValue([]);

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        requiredSkillIds: ['11111111-1111-4111-8111-111111111111'],
      }),
    ).rejects.toThrow('One or more skills do not exist');

    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should reject a skill that is both required and preferred', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    const skillId = '11111111-1111-4111-8111-111111111111';

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        requiredSkillIds: [skillId],
        preferredSkillIds: [skillId],
      }),
    ).rejects.toThrow('A skill cannot be both required and preferred');

    expect(prisma.skill.findMany).not.toHaveBeenCalled();
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should return jobs belonging only to the recruiter company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    const jobs: JobRecord[] = [
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

    const result = await serviceResult<JobRecord[]>(() =>
      service.getAll('user-a'),
    );

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

  it('should reject users who are not recruiters when retrieving jobs', async () => {
    prisma.recruiter.findUnique.mockResolvedValue(null);

    await expect(service.getAll('user-id')).rejects.toThrow(
      'Only recruiters can access jobs',
    );

    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it('should reject a recruiter without a company when retrieving jobs', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: null,
    } satisfies RecruiterRecord);

    await expect(service.getAll('user-id')).rejects.toThrow(
      'Recruiter is not assigned to a company',
    );

    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it('should return a job belonging to the recruiter company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    const job: JobRecord = {
      id: 'job-1',
      companyId: 'company-a',
      title: 'Backend Developer',
    };

    prisma.job.findFirst.mockResolvedValue(job);

    const result = await serviceResult<JobRecord>(() =>
      service.getById('user-a', 'job-1'),
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

  it('should not return a job belonging to another company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue(null);

    await expect(
      service.getById('user-a', 'job-from-company-b'),
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

  it('should reject non-recruiters when retrieving a job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue(null);

    await expect(service.getById('user-id', 'job-id')).rejects.toThrow(
      'Only recruiters can access jobs',
    );

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it('should reject a recruiter without a company when retrieving a job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: null,
    } satisfies RecruiterRecord);

    await expect(service.getById('user-id', 'job-id')).rejects.toThrow(
      'Recruiter is not assigned to a company',
    );

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it('should return a published, non-expired job for candidates', async () => {
    const job: JobRecord = {
      id: 'job-1',
      status: 'PUBLISHED',
      title: 'Backend Developer',
    };

    prisma.job.findFirst.mockResolvedValue(job);

    const result = await serviceResult<JobRecord>(() =>
      service.getPublicById('job-1'),
    );

    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        status: 'PUBLISHED',
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: expect.any(Date),
            },
          },
        ],
      },
      include: {
        company: true,
        requirements: {
          include: {
            skill: true,
          },
        },
      },
    });

    expect(result).toEqual(job);
  });

  it('should reject a non-public job for candidates', async () => {
    prisma.job.findFirst.mockResolvedValue(null);

    await expect(service.getPublicById('job-id')).rejects.toThrow(
      'Job not found',
    );

    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'job-id',
          status: 'PUBLISHED',
        }),
      }),
    );
  });

  it('should update a job belonging to the recruiter company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
      salaryMin: 4000,
      salaryMax: 6000,
    } satisfies JobRecord);

    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
      title: 'Senior Backend Developer',
    } satisfies JobRecord);

    const result = await serviceResult<ServiceJobResult>(() =>
      service.update('user-a', 'job-1', {
        title: 'Senior Backend Developer',
      }),
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

  it('should reject updating a job belonging to another company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-a', 'job-from-company-b', {
        title: 'Updated Job',
      }),
    ).rejects.toThrow('Job not found');

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject non-recruiters when updating a job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue(null);

    await expect(
      service.update('user-id', 'job-id', {
        title: 'Updated Job',
      }),
    ).rejects.toThrow('Only recruiters can update jobs');

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject a recruiter without a company when updating a job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: null,
    } satisfies RecruiterRecord);

    await expect(
      service.update('user-id', 'job-id', {
        title: 'Updated Job',
      }),
    ).rejects.toThrow('Recruiter is not assigned to a company');

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject an invalid salary range when updating a job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
      salaryMin: 4000,
      salaryMax: 6000,
    } satisfies JobRecord);

    await expect(
      service.update('user-a', 'job-1', {
        salaryMin: 7000,
        salaryMax: 5000,
      }),
    ).rejects.toThrow('salaryMax cannot be lower than salaryMin');

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject duplicate required skills', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    const skillId = '11111111-1111-4111-8111-111111111111';

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        requiredSkillIds: [skillId, skillId],
      }),
    ).rejects.toThrow('A skill cannot be added to a job more than once');

    expect(prisma.skill.findMany).not.toHaveBeenCalled();
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should reject duplicate preferred skills', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      id: 'recruiter-id',
      companyId: 'company-id',
    } satisfies RecruiterRecord);

    const skillId = '11111111-1111-4111-8111-111111111111';

    await expect(
      service.create('user-id', {
        title: 'Backend Developer',
        description: 'Build and maintain backend services.',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        preferredSkillIds: [skillId, skillId],
      }),
    ).rejects.toThrow('A skill cannot be added to a job more than once');

    expect(prisma.skill.findMany).not.toHaveBeenCalled();
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('should replace job requirements during update', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
      salaryMin: 4000,
      salaryMax: 6000,
    } satisfies JobRecord);

    prisma.skill.findMany.mockResolvedValue([
      { id: 'skill-required' },
      { id: 'skill-preferred' },
    ] satisfies SkillRecord[]);

    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

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
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
      salaryMin: 4000,
      salaryMax: 6000,
    } satisfies JobRecord);

    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

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

  it('should return requirements for a job belonging to the recruiter company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

    const requirements: JobRequirementRecord[] = [
      {
        id: 'requirement-1',
        jobId: 'job-1',
        skillId: 'skill-1',
        required: true,
        minimumLevel: 1,
        skill: {
          id: 'skill-1',
          name: 'TypeScript',
        },
      },
      {
        id: 'requirement-2',
        jobId: 'job-1',
        skillId: 'skill-2',
        required: false,
        minimumLevel: 1,
        skill: {
          id: 'skill-2',
          name: 'Docker',
        },
      },
    ];

    prisma.jobRequirement.findMany.mockResolvedValue(requirements);

    const result = await serviceResult<JobRequirementRecord[]>(() =>
      service.getRequirements('user-a', 'job-1'),
    );

    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        companyId: 'company-a',
      },
      select: {
        id: true,
      },
    });

    expect(prisma.jobRequirement.findMany).toHaveBeenCalledWith({
      where: {
        jobId: 'job-1',
      },
      include: {
        skill: true,
      },
      orderBy: [
        {
          required: 'desc',
        },
        {
          skill: {
            name: 'asc',
          },
        },
      ],
    });

    expect(result).toEqual(requirements);
  });

  it('should reject retrieving requirements from another company', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue(null);

    await expect(
      service.getRequirements('user-a', 'job-from-company-b'),
    ).rejects.toThrow('Job not found');
  });

  it('should reject non-recruiters when retrieving requirements', async () => {
    prisma.recruiter.findUnique.mockResolvedValue(null);

    await expect(service.getRequirements('user-id', 'job-id')).rejects.toThrow(
      'Only recruiters can access job requirements',
    );

    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.jobRequirement.findMany).not.toHaveBeenCalled();
  });

  it('should replace job requirements', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

    prisma.skill.findMany.mockResolvedValue([
      { id: 'skill-required' },
      { id: 'skill-preferred' },
    ] satisfies SkillRecord[]);

    const transactionClient: TransactionClient = {
      jobRequirement: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const transactionRequirements: JobRequirementRecord[] = [
      {
        id: 'requirement-1',
        jobId: 'job-1',
        skillId: 'skill-required',
        required: true,
        minimumLevel: 1,
      },
      {
        id: 'requirement-2',
        jobId: 'job-1',
        skillId: 'skill-preferred',
        required: false,
        minimumLevel: 1,
      },
    ];

    transactionClient.jobRequirement.findMany.mockResolvedValue(
      transactionRequirements,
    );

    prisma.$transaction.mockImplementation(
      (callback: (tx: TransactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    );

    const result = await serviceResult<JobRequirementRecord[]>(() =>
      service.updateRequirements('user-a', 'job-1', {
        requiredSkillIds: ['skill-required'],
        preferredSkillIds: ['skill-preferred'],
      }),
    );

    expect(prisma.$transaction).toHaveBeenCalled();

    expect(transactionClient.jobRequirement.deleteMany).toHaveBeenCalledWith({
      where: {
        jobId: 'job-1',
      },
    });

    expect(transactionClient.jobRequirement.createMany).toHaveBeenCalledWith({
      data: [
        {
          jobId: 'job-1',
          skillId: 'skill-required',
          required: true,
          minimumLevel: 1,
        },
        {
          jobId: 'job-1',
          skillId: 'skill-preferred',
          required: false,
          minimumLevel: 1,
        },
      ],
    });

    expect(result).toEqual(transactionRequirements);
  });

  it('should reject unknown skills when updating requirements', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

    prisma.skill.findMany.mockResolvedValue([]);

    await expect(
      service.updateRequirements('user-a', 'job-1', {
        requiredSkillIds: ['skill-does-not-exist'],
      }),
    ).rejects.toThrow('One or more skills do not exist');

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject duplicate skills when updating requirements', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

    await expect(
      service.updateRequirements('user-a', 'job-1', {
        requiredSkillIds: ['skill-1', 'skill-1'],
      }),
    ).rejects.toThrow('A skill cannot be added to a job more than once');

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should reject a skill that is both required and preferred', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      companyId: 'company-a',
    } satisfies JobRecord);

    await expect(
      service.updateRequirements('user-a', 'job-1', {
        requiredSkillIds: ['skill-1'],
        preferredSkillIds: ['skill-1'],
      }),
    ).rejects.toThrow('A skill cannot be both required and preferred');

    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('should remove a job requirement', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
    } satisfies JobRecord);

    prisma.jobRequirement.findUnique.mockResolvedValue({
      id: 'requirement-1',
      jobId: 'job-1',
      skillId: 'skill-1',
    } satisfies JobRequirementRecord);

    prisma.jobRequirement.delete.mockResolvedValue({
      id: 'requirement-1',
    } satisfies Pick<JobRequirementRecord, 'id'>);

    const result = await serviceResult<MessageResult>(() =>
      service.removeRequirement('user-a', 'job-1', 'skill-1'),
    );

    expect(prisma.jobRequirement.delete).toHaveBeenCalledWith({
      where: {
        id: 'requirement-1',
      },
    });

    expect(result).toEqual({
      message: 'Job requirement removed successfully',
    });
  });

  it('should reject removing a non-existing job requirement', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
    } satisfies JobRecord);

    prisma.jobRequirement.findUnique.mockResolvedValue(null);

    await expect(
      service.removeRequirement('user-a', 'job-1', 'skill-does-not-exist'),
    ).rejects.toThrow('Job requirement not found');

    expect(prisma.jobRequirement.delete).not.toHaveBeenCalled();
  });

  it('should publish a draft job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'DRAFT',
    } satisfies JobRecord);

    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    } satisfies JobRecord);

    const result = await serviceResult<{ status: string }>(() =>
      service.publish('user-a', 'job-1'),
    );

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      },
    });

    expect(result.status).toBe('PUBLISHED');
  });

  it('should close a published job', async () => {
    prisma.recruiter.findUnique.mockResolvedValue({
      companyId: 'company-a',
    } satisfies RecruiterRecord);

    prisma.job.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'PUBLISHED',
    } satisfies JobRecord);

    prisma.job.update.mockResolvedValue({
      id: 'job-1',
      status: 'CLOSED',
    } satisfies JobRecord);

    const result = await serviceResult<{ status: string }>(() =>
      service.close('user-a', 'job-1'),
    );

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
      },
      data: {
        status: 'CLOSED',
      },
    });

    expect(result.status).toBe('CLOSED');
  });

  it('should discover published and non-expired jobs with pagination', async () => {
    const items: JobRecord[] = [
      {
        id: 'job-1',
        status: 'PUBLISHED',
        title: 'Backend Developer',
      },
    ];

    prisma.job.findMany.mockResolvedValue(items);
    prisma.job.count.mockResolvedValue(1);

    prisma.$transaction.mockResolvedValue([items, 1]);

    const result = await serviceResult<DiscoveryResult>(() =>
      service.discover({
        page: 2,
        limit: 10,
      }),
    );

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: expect.any(Array),
        }),
        skip: 10,
        take: 10,
        orderBy: {
          publishedAt: 'desc',
        },
      }),
    );

    expect(prisma.job.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: expect.any(Array),
        }),
      }),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      items,
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
  });

  it('should reject an invalid discovery salary range', async () => {
    await expect(
      service.discover({
        salaryMin: 7000,
        salaryMax: 5000,
      }),
    ).rejects.toThrow('salaryMax cannot be lower than salaryMin');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should apply discovery search and filters', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.discover({
      q: 'TypeScript',
      location: 'Amsterdam',
      workMode: 'REMOTE',
      employmentType: 'FULL_TIME',
      salaryMin: 4000,
      salaryMax: 6000,
      skillIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    const findManyCalls = prisma.job.findMany.mock.calls as unknown[][];
    const countCalls = prisma.job.count.mock.calls as unknown[][];

    const findManyCall = findManyCalls[0]?.[0];
    const countCall = countCalls[0]?.[0];

    expect(findManyCall).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                {
                  title: {
                    contains: 'TypeScript',
                    mode: 'insensitive',
                  },
                },
                {
                  description: {
                    contains: 'TypeScript',
                    mode: 'insensitive',
                  },
                },
                {
                  company: {
                    name: {
                      contains: 'TypeScript',
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }),
            expect.objectContaining({
              location: {
                contains: 'Amsterdam',
                mode: 'insensitive',
              },
            }),
            expect.objectContaining({
              workMode: 'REMOTE',
            }),
            expect.objectContaining({
              employmentType: 'FULL_TIME',
            }),
            expect.objectContaining({
              salaryMax: {
                gte: 4000,
                lte: 6000,
              },
            }),
            expect.objectContaining({
              requirements: {
                some: {
                  skillId: '11111111-1111-4111-8111-111111111111',
                },
              },
            }),
            expect.objectContaining({
              requirements: {
                some: {
                  skillId: '22222222-2222-4222-8222-222222222222',
                },
              },
            }),
          ]),
        }),
      }),
    );

    expect(countCall).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it('should apply skill filters using skill IDs', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.discover({
      skillIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    const findManyCalls = prisma.job.findMany.mock.calls as unknown[][];
    const findManyCall = findManyCalls[0]?.[0];

    expect(findManyCall).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              requirements: {
                some: {
                  skillId: '11111111-1111-4111-8111-111111111111',
                },
              },
            }),
            expect.objectContaining({
              requirements: {
                some: {
                  skillId: '22222222-2222-4222-8222-222222222222',
                },
              },
            }),
          ]),
        }),
      }),
    );

    expect(prisma.job.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it('should apply salary sorting', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.discover({
      sort: 'salary',
    });

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          salaryMax: 'desc',
        },
      }),
    );

    expect(prisma.job.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
        }),
      }),
    );
  });

  it('should apply title sorting', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.discover({
      sort: 'title',
    });

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          title: 'asc',
        },
      }),
    );

    expect(prisma.job.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
        }),
      }),
    );
  });
});
