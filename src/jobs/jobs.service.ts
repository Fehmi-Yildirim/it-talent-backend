import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobRequirementsDto } from './dto/update-job-requirements.dto';

@Injectable()
export class JobsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // Create a Job
    async create(
        userId: string,
        dto: CreateJobDto,
    ) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
                where: {
                    userId,
                },
                select: {
                    id: true,
                    companyId: true,
                },
            });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can create jobs',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
        }

        if (
            dto.salaryMin !== undefined &&
            dto.salaryMax !== undefined &&
            dto.salaryMax < dto.salaryMin
        ) {
            throw new BadRequestException(
                'salaryMax cannot be lower than salaryMin',
            );
        }

        const requiredSkillIds = dto.requiredSkillIds ?? [];
        const preferredSkillIds = dto.preferredSkillIds ?? [];

        const hasDuplicates = (ids: string[]) =>
            new Set(ids).size !== ids.length;

        if (
            hasDuplicates(requiredSkillIds) ||
            hasDuplicates(preferredSkillIds)
        ) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }

        const duplicateSkillIds =
            requiredSkillIds.filter((skillId) =>
                preferredSkillIds.includes(skillId),
            );

        if (duplicateSkillIds.length > 0) {
            throw new BadRequestException(
                'A skill cannot be both required and preferred',
            );
        }

        const skillIds = [
            ...new Set([
                ...requiredSkillIds,
                ...preferredSkillIds,
            ]),
        ];

        if (skillIds.length > 0) {
            const skills =
                await this.prisma.skill.findMany({
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
                throw new BadRequestException(
                    'One or more skills do not exist',
                );
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

                expiresAt: dto.expiresAt
                    ? new Date(dto.expiresAt)
                    : undefined,

                status: 'DRAFT',

                requirements: {
                    create: [
                        ...requiredSkillIds.map(
                            (skillId) => ({
                                skillId,
                                required: true,
                                minimumLevel: 1,
                            }),
                        ),
                        ...preferredSkillIds.map(
                            (skillId) => ({
                                skillId,
                                required: false,
                                minimumLevel: 1,
                            }),
                        ),
                    ],
                },
            },
        });
    }

    // Get All Jobs
    async getAll(userId: string) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
                where: {
                    userId,
                },
                select: {
                    companyId: true,
                },
            });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can access jobs',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
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

    // Get by ID
    async getById(userId: string, jobId: string) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
                where: {
                    userId,
                },
                select: {
                    companyId: true,
                },
            });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can access jobs',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
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
            throw new NotFoundException(
                'Job not found',
            );
        }

        return job;
    }

    // Get requirements for a job
    async getRequirements(
        userId: string,
        jobId: string,
    ) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
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
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
        }

        const job =
            await this.prisma.job.findFirst({
                where: {
                    id: jobId,
                    companyId: recruiter.companyId,
                },
                select: {
                    id: true,
                },
            });

        if (!job) {
            throw new NotFoundException(
                'Job not found',
            );
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

    // Update all requirements for a job
    async updateRequirements(
        userId: string,
        jobId: string,
        dto: UpdateJobRequirementsDto,
    ) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
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
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
        }

        const job =
            await this.prisma.job.findFirst({
                where: {
                    id: jobId,
                    companyId: recruiter.companyId,
                },
                select: {
                    id: true,
                },
            });

        if (!job) {
            throw new NotFoundException(
                'Job not found',
            );
        }

        const requiredSkillIds =
            dto.requiredSkillIds ?? [];

        const preferredSkillIds =
            dto.preferredSkillIds ?? [];

        const hasDuplicates = (ids: string[]) =>
            new Set(ids).size !== ids.length;

        if (
            hasDuplicates(requiredSkillIds) ||
            hasDuplicates(preferredSkillIds)
        ) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }

        const overlap =
            requiredSkillIds.filter((skillId) =>
                preferredSkillIds.includes(skillId),
            );

        if (overlap.length > 0) {
            throw new BadRequestException(
                'A skill cannot be both required and preferred',
            );
        }

        const skillIds = [
            ...requiredSkillIds,
            ...preferredSkillIds,
        ];

        if (skillIds.length > 0) {
            const skills =
                await this.prisma.skill.findMany({
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
                throw new BadRequestException(
                    'One or more skills do not exist',
                );
            }
        }

        return this.prisma.$transaction(
            async (tx) => {
                await tx.jobRequirement.deleteMany({
                    where: {
                        jobId: job.id,
                    },
                });

                await tx.jobRequirement.createMany({
                    data: [
                        ...requiredSkillIds.map(
                            (skillId) => ({
                                jobId: job.id,
                                skillId,
                                required: true,
                                minimumLevel: 1,
                            }),
                        ),
                        ...preferredSkillIds.map(
                            (skillId) => ({
                                jobId: job.id,
                                skillId,
                                required: false,
                                minimumLevel: 1,
                            }),
                        ),
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
            },
        );
    }

    // Delete all requirements for a job
    async removeRequirement(
        userId: string,
        jobId: string,
        skillId: string,
    ) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
                where: { userId },
                select: { companyId: true },
            });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can modify job requirements',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
        }

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
            },
            select: { id: true },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const requirement =
            await this.prisma.jobRequirement.findUnique({
                where: {
                    jobId_skillId: {
                        jobId: job.id,
                        skillId,
                    },
                },
            });

        if (!requirement) {
            throw new NotFoundException(
                'Job requirement not found',
            );
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

    // Update an existing job
    async update(
        userId: string,
        jobId: string,
        dto: UpdateJobDto,
    ) {
        const recruiter =
            await this.prisma.recruiter.findUnique({
                where: {
                    userId,
                },
                select: {
                    companyId: true,
                },
            });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can update jobs',
            );
        }

        if (!recruiter.companyId) {
            throw new BadRequestException(
                'Recruiter is not assigned to a company',
            );
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
            throw new NotFoundException(
                'Job not found',
            );
        }

        // Validate the resulting salary range.
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

        const requiredSkillIds =
            dto.requiredSkillIds;

        const preferredSkillIds =
            dto.preferredSkillIds;

        const hasDuplicates = (ids: string[]) =>
            new Set(ids).size !== ids.length;

        if (
            (requiredSkillIds !== undefined &&
                hasDuplicates(requiredSkillIds)) ||
            (preferredSkillIds !== undefined &&
                hasDuplicates(preferredSkillIds))
        ) {
            throw new BadRequestException(
                'A skill cannot be added to a job more than once',
            );
        }



        // Validate required and preferred skill separation.
        if (
            requiredSkillIds !== undefined &&
            preferredSkillIds !== undefined
        ) {
            const overlap =
                requiredSkillIds.filter((skillId) =>
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

        // Validate that all referenced skills exist.
        if (skillIds.length > 0) {
            const skills =
                await this.prisma.skill.findMany({
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
                throw new BadRequestException(
                    'One or more skills do not exist',
                );
            }
        }

        const {
            requiredSkillIds: _requiredSkillIds,
            preferredSkillIds: _preferredSkillIds,
            ...jobData
        } = dto;

        const updateData = {
            ...jobData,
            ...(requiredSkillIds !== undefined ||
                preferredSkillIds !== undefined
                ? {
                    requirements: {
                        deleteMany: {},
                        create: [
                            ...(requiredSkillIds ?? []).map(
                                (skillId) => ({
                                    skillId,
                                    required: true,
                                    minimumLevel: 1,
                                }),
                            ),
                            ...(preferredSkillIds ?? []).map(
                                (skillId) => ({
                                    skillId,
                                    required: false,
                                    minimumLevel: 1,
                                }),
                            ),
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
}