import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkMode, EmploymentType } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { GetJobsQueryDto } from './dto/get-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobRequirementsDto } from './dto/update-job-requirements.dto';
import { CreateJobRequirementDto } from './dto/create-job-requirement.dto';
import { UpdateJobRequirementDto } from './dto/update-job-requirement.dto';

@Injectable()
export class JobsService {
    constructor(private readonly prisma: PrismaService) { }

    // Create a Job
    async create(userId: string, dto: CreateJobDto) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                id: true,
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can create jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        if (
            dto.salaryMin !== undefined &&
            dto.salaryMax !== undefined &&
            dto.salaryMax < dto.salaryMin
        ) {
            throw new BadRequestException('salaryMax cannot be lower than salaryMin');
        }

        const requiredSkillIds = dto.requiredSkillIds ?? [];
        const preferredSkillIds = dto.preferredSkillIds ?? [];

        const hasDuplicates = (ids: string[]) => new Set(ids).size !== ids.length;

        if (hasDuplicates(requiredSkillIds) || hasDuplicates(preferredSkillIds)) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }

        const duplicateSkillIds = requiredSkillIds.filter((skillId) =>
            preferredSkillIds.includes(skillId),
        );

        if (duplicateSkillIds.length > 0) {
            throw new BadRequestException(
                'A skill cannot be both required and preferred',
            );
        }

        const skillIds = [...new Set([...requiredSkillIds, ...preferredSkillIds])];

        if (skillIds.length > 0) {
            const skills = await this.prisma.skill.findMany({
                where: {
                    id: {
                        in: skillIds,
                    },
                },
                select: {
                    id: true,
                },
            });

            if (skills.length !== skillIds.length) {
                throw new BadRequestException('One or more skills do not exist');
            }
        }

        return this.prisma.job.create({
            data: {
                companyId: recruiter.companyId,
                createdByRecruiterId: recruiter.id,

                title: dto.title.trim(),
                description: dto.description.trim(),
                location: dto.location?.trim(),

                employmentType: dto.employmentType,
                workMode: dto.workMode,

                salaryMin: dto.salaryMin,
                salaryMax: dto.salaryMax,
                currency: dto.currency?.trim(),

                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,

                status: 'DRAFT',

                requirements: {
                    create: [
                        ...requiredSkillIds.map((skillId) => ({
                            skillId,
                            required: true,
                            minimumLevel: 1,
                        })),
                        ...preferredSkillIds.map((skillId) => ({
                            skillId,
                            required: false,
                            minimumLevel: 1,
                        })),
                    ],
                },
            },
        });
    }

    // Get all jobs
    async getAll(userId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can access jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        return this.prisma.job.findMany({
            where: {
                companyId: recruiter.companyId,
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
    }

    // Candidate job discovery
    async discover(query: GetJobsQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        if (
            query.salaryMin !== undefined &&
            query.salaryMax !== undefined &&
            query.salaryMax < query.salaryMin
        ) {
            throw new BadRequestException(
                'salaryMax cannot be lower than salaryMin',
            );
        }

        const andFilters: Prisma.JobWhereInput[] = [
            {
                OR: [
                    {
                        expiresAt: null,
                    },
                    {
                        expiresAt: {
                            gt: new Date(),
                        },
                    },
                ],
            },
        ];

        const where: Prisma.JobWhereInput = {
            status: 'PUBLISHED',
            AND: andFilters,
        };

        // General search across job title, description, company,
        // location, work mode, employment type, and skill names.
        if (query.q) {
            const searchTerm = query.q.trim();
            const normalizedSearchTerm = searchTerm.toLowerCase();

            const workModeMatch = Object.values(WorkMode).find(
                (value) => value.toLowerCase() === normalizedSearchTerm,
            );

            const employmentTypeMatch = Object.values(EmploymentType).find(
                (value) => value.toLowerCase() === normalizedSearchTerm,
            );

            andFilters.push({
                OR: [
                    {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    {
                        description: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    {
                        company: {
                            name: {
                                contains: searchTerm,
                                mode: 'insensitive',
                            },
                        },
                    },
                    {
                        location: {
                            contains: searchTerm,
                            mode: 'insensitive',
                        },
                    },
                    ...(workModeMatch
                        ? [
                            {
                                workMode: workModeMatch,
                            },
                        ]
                        : []),
                    ...(employmentTypeMatch
                        ? [
                            {
                                employmentType: employmentTypeMatch,
                            },
                        ]
                        : []),
                    {
                        requirements: {
                            some: {
                                skill: {
                                    name: {
                                        contains: searchTerm,
                                        mode: 'insensitive',
                                    },
                                },
                            },
                        },
                    },
                ],
            });
        }

        // Filter by location
        if (query.location) {
            andFilters.push({
                location: {
                    contains: query.location,
                    mode: 'insensitive',
                },
            });
        }

        // Filter by work mode
        if (query.workModes?.length) {
            andFilters.push({
                workMode: {
                    in: query.workModes,
                },
            });
        } else if (query.workMode) {
            andFilters.push({
                workMode: query.workMode,
            });
        }

        // Filter by employment type
        // Supports both:
        // ?employmentType=FULL_TIME
        // ?employmentTypes=FULL_TIME,PART_TIME
        if (query.employmentTypes?.length) {
            andFilters.push({
                employmentType: {
                    in: query.employmentTypes,
                },
            });
        } else if (query.employmentType) {
            andFilters.push({
                employmentType: query.employmentType,
            });
        }

        // Filter by salary
        if (query.salaryMin !== undefined && query.salaryMax !== undefined) {
            andFilters.push({
                salaryMax: {
                    gte: query.salaryMin,
                    lte: query.salaryMax,
                },
            });
        } else if (query.salaryMin !== undefined) {
            andFilters.push({
                salaryMax: {
                    gte: query.salaryMin,
                },
            });
        } else if (query.salaryMax !== undefined) {
            andFilters.push({
                salaryMax: {
                    lte: query.salaryMax,
                },
            });
        }

        // Filter by skills
        // Every supplied skill ID must be present on the job.
        if (query.skillIds?.length) {
            for (const skillId of query.skillIds) {
                andFilters.push({
                    requirements: {
                        some: {
                            skillId,
                        },
                    },
                });
            }
        }

        // Sorting
        let orderBy: Prisma.JobOrderByWithRelationInput = {
            publishedAt: 'desc',
        };

        switch (query.sort) {
            case 'salary':
                orderBy = {
                    salaryMax: 'desc',
                };
                break;

            case 'title':
                orderBy = {
                    title: 'asc',
                };
                break;

            case 'newest':
            default:
                orderBy = {
                    publishedAt: 'desc',
                };
                break;
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.job.findMany({
                where,
                include: {
                    company: true,
                    requirements: {
                        include: {
                            skill: true,
                        },
                    },
                },
                orderBy,
                skip,
                take: limit,
            }),
            this.prisma.job.count({
                where,
            }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // Get job by ID
    async getById(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can access jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        return job;
    }

    // Get public job detail for candidates
    async getPublicById(jobId: string) {
        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                status: 'PUBLISHED',
                OR: [
                    {
                        expiresAt: null,
                    },
                    {
                        expiresAt: {
                            gt: new Date(),
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

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        return job;
    }

    // Update an existing job
    async update(userId: string, jobId: string, dto: UpdateJobDto) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can update jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                companyId: true,
                salaryMin: true,
                salaryMax: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        // Validate resulting salary range.
        const resultingSalaryMin =
            dto.salaryMin !== undefined
                ? dto.salaryMin
                : job.salaryMin !== null
                    ? Number(job.salaryMin)
                    : undefined;

        const resultingSalaryMax =
            dto.salaryMax !== undefined
                ? dto.salaryMax
                : job.salaryMax !== null
                    ? Number(job.salaryMax)
                    : undefined;

        if (
            resultingSalaryMin !== undefined &&
            resultingSalaryMax !== undefined &&
            resultingSalaryMax < resultingSalaryMin
        ) {
            throw new BadRequestException(
                'salaryMax cannot be lower than salaryMin',
            );
        }

        const requiredSkillIds = dto.requiredSkillIds;
        const preferredSkillIds = dto.preferredSkillIds;

        const hasDuplicates = (ids: string[]) => new Set(ids).size !== ids.length;

        if (
            (requiredSkillIds !== undefined && hasDuplicates(requiredSkillIds)) ||
            (preferredSkillIds !== undefined && hasDuplicates(preferredSkillIds))
        ) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }

        // Validate required/preferred separation.
        if (requiredSkillIds !== undefined && preferredSkillIds !== undefined) {
            const overlap = requiredSkillIds.filter((skillId) =>
                preferredSkillIds.includes(skillId),
            );

            if (overlap.length > 0) {
                throw new BadRequestException(
                    'A skill cannot be both required and preferred',
                );
            }
        }

        const skillIds = [
            ...new Set([
                ...(requiredSkillIds ?? []),
                ...(preferredSkillIds ?? []),
            ]),
        ];

        // Validate referenced skills.
        if (skillIds.length > 0) {
            const skills = await this.prisma.skill.findMany({
                where: {
                    id: {
                        in: skillIds,
                    },
                },
                select: {
                    id: true,
                },
            });

            if (skills.length !== skillIds.length) {
                throw new BadRequestException('One or more skills do not exist');
            }
        }

        const {
            requiredSkillIds: _requiredSkillIds,
            preferredSkillIds: _preferredSkillIds,
            ...jobData
        } = dto;

        void _requiredSkillIds;
        void _preferredSkillIds;

        const updateData: Prisma.JobUpdateInput = {
            ...jobData,
            ...(dto.expiresAt !== undefined
                ? { expiresAt: new Date(dto.expiresAt) }
                : {}),
            ...(requiredSkillIds !== undefined || preferredSkillIds !== undefined
                ? {
                    requirements: {
                        deleteMany: {},
                        create: [
                            ...(requiredSkillIds ?? []).map((skillId) => ({
                                skillId,
                                required: true,
                                minimumLevel: 1,
                            })),
                            ...(preferredSkillIds ?? []).map((skillId) => ({
                                skillId,
                                required: false,
                                minimumLevel: 1,
                            })),
                        ],
                    },
                }
                : {}),
        };

        return this.prisma.job.update({
            where: {
                id: jobId,
            },
            data: updateData,
        });
    }

    // Publish a draft job
    async publish(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can publish jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== 'DRAFT') {
            throw new BadRequestException('Only draft jobs can be published');
        }

        return this.prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    }

    // Pause a published job
    async pause(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can pause jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== 'PUBLISHED') {
            throw new BadRequestException('Only published jobs can be paused');
        }

        return this.prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                status: 'PAUSED',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    }

    // Resume a paused job
    async resume(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can resume jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== 'PAUSED') {
            throw new BadRequestException('Only paused jobs can be resumed');
        }

        return this.prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                status: 'PUBLISHED',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    }

    // Close a published or paused job
    async close(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can close jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== 'PUBLISHED' && job.status !== 'PAUSED') {
            throw new BadRequestException(
                'Only published or paused jobs can be closed',
            );
        }

        return this.prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                status: 'CLOSED',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    }

    // Reopen a closed job as draft
    async reopen(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException('Only recruiters can reopen jobs');
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        if (job.status !== 'CLOSED') {
            throw new BadRequestException('Only closed jobs can be reopened');
        }

        return this.prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                status: 'DRAFT',
            },
            include: {
                requirements: {
                    include: {
                        skill: true,
                    },
                },
            },
        });
    }

    // Get requirements for a job
    async getRequirements(userId: string, jobId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can access job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        return this.prisma.jobRequirement.findMany({
            where: {
                jobId: job.id,
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
    }

    // Replace all job requirements
    async updateRequirements(
        userId: string,
        jobId: string,
        dto: UpdateJobRequirementsDto,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can update job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const requiredSkillIds = dto.requiredSkillIds ?? [];
        const preferredSkillIds = dto.preferredSkillIds ?? [];

        const hasDuplicates = (ids: string[]) => new Set(ids).size !== ids.length;

        if (hasDuplicates(requiredSkillIds) || hasDuplicates(preferredSkillIds)) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }

        const overlap = requiredSkillIds.filter((skillId) =>
            preferredSkillIds.includes(skillId),
        );

        if (overlap.length > 0) {
            throw new BadRequestException(
                'A skill cannot be both required and preferred',
            );
        }

        const skillIds = [...requiredSkillIds, ...preferredSkillIds];

        if (skillIds.length > 0) {
            const skills = await this.prisma.skill.findMany({
                where: {
                    id: {
                        in: skillIds,
                    },
                },
                select: {
                    id: true,
                },
            });

            if (skills.length !== skillIds.length) {
                throw new BadRequestException('One or more skills do not exist');
            }
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.jobRequirement.deleteMany({
                where: {
                    jobId: job.id,
                },
            });

            await tx.jobRequirement.createMany({
                data: [
                    ...requiredSkillIds.map((skillId) => ({
                        jobId: job.id,
                        skillId,
                        required: true,
                        minimumLevel: 1,
                    })),
                    ...preferredSkillIds.map((skillId) => ({
                        jobId: job.id,
                        skillId,
                        required: false,
                        minimumLevel: 1,
                    })),
                ],
            });

            return tx.jobRequirement.findMany({
                where: {
                    jobId: job.id,
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
        });
    }

    // Add one job requirement
    async createRequirement(
        userId: string,
        jobId: string,
        dto: CreateJobRequirementDto,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can create job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const skill = await this.prisma.skill.findUnique({
            where: {
                id: dto.skillId,
            },
            select: {
                id: true,
            },
        });

        if (!skill) {
            throw new BadRequestException('Skill does not exist');
        }

        const existingRequirement = await this.prisma.jobRequirement.findUnique({
            where: {
                jobId_skillId: {
                    jobId: job.id,
                    skillId: dto.skillId,
                },
            },
            select: {
                id: true,
            },
        });

        if (existingRequirement) {
            throw new BadRequestException(
                'This skill is already a requirement for this job',
            );
        }

        return this.prisma.jobRequirement.create({
            data: {
                jobId: job.id,
                skillId: dto.skillId,
                required: dto.required,
                minimumLevel: dto.minimumLevel,
            },
            include: {
                skill: true,
            },
        });
    }

    // Update one job requirement
    async updateRequirement(
        userId: string,
        jobId: string,
        requirementId: string,
        dto: UpdateJobRequirementDto,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can update job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const requirement = await this.prisma.jobRequirement.findFirst({
            where: {
                id: requirementId,
                jobId: job.id,
            },
            select: {
                id: true,
                required: true,
                minimumLevel: true,
                skillId: true,
            },
        });

        if (!requirement) {
            throw new NotFoundException('Job requirement not found');
        }

        if (dto.required === undefined && dto.minimumLevel === undefined) {
            throw new BadRequestException('At least one field must be provided');
        }

        const updateData = {
            ...(dto.required !== undefined
                ? {
                    required: dto.required,
                }
                : {}),
            ...(dto.minimumLevel !== undefined
                ? {
                    minimumLevel: dto.minimumLevel,
                }
                : {}),
        };

        return this.prisma.jobRequirement.update({
            where: {
                id: requirement.id,
            },
            data: updateData,
            include: {
                skill: true,
            },
        });
    }

    // Remove one job requirement
    async removeRequirement(userId: string, jobId: string, skillId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                companyId: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can modify job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException('Recruiter is not assigned to a company');
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: {
                id: true,
            },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const requirement = await this.prisma.jobRequirement.findUnique({
            where: {
                jobId_skillId: {
                    jobId: job.id,
                    skillId,
                },
            },
        });

        if (!requirement) {
            throw new NotFoundException('Job requirement not found');
        }

        await this.prisma.jobRequirement.delete({
            where: {
                id: requirement.id,
            },
        });

        return {
            message: 'Job requirement removed successfully',
        };
    }
}