import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { JobStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';

type CandidateSkillForMatching = {
    skillId: string;
    proficiencyLevel: number;
    skill: { name: string };
};

type JobRequirementForMatching = {
    skillId: string;
    minimumLevel: number;
    required: boolean;
    weight: Prisma.Decimal | null;
    skill: { name: string };
};

@Injectable()
export class MatchingService {
    constructor(private readonly prisma: PrismaService) { }

    async recalculateCandidate(candidateId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: {
                candidateSkills: {
                    include: {
                        skill: { select: { name: true } },
                    },
                },
            },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate not found');
        }

        const now = new Date();

        const jobs = await this.prisma.job.findMany({
            where: {
                status: JobStatus.PUBLISHED,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            include: {
                requirements: {
                    include: {
                        skill: { select: { name: true } },
                    },
                },
            },
        });

        for (const job of jobs) {
            if (job.requirements.length === 0) {
                await this.prisma.match.deleteMany({
                    where: { candidateId, jobId: job.id },
                });
                continue;
            }

            const result = this.calculateSkillScore(
                candidate.candidateSkills,
                job.requirements,
            );

            await this.saveMatch(candidateId, job.id, result);
        }

        return {
            calculated: jobs.filter((job) => job.requirements.length > 0).length,
        };
    }

    async recalculateJob(jobId: string) {
        const now = new Date();

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                status: JobStatus.PUBLISHED,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            include: {
                requirements: {
                    include: {
                        skill: { select: { name: true } },
                    },
                },
            },
        });

        if (!job || job.requirements.length === 0) {
            await this.prisma.match.deleteMany({ where: { jobId } });
            return { calculated: 0 };
        }

        const candidates = await this.prisma.candidate.findMany({
            include: {
                candidateSkills: {
                    include: {
                        skill: { select: { name: true } },
                    },
                },
            },
        });

        for (const candidate of candidates) {
            const result = this.calculateSkillScore(
                candidate.candidateSkills,
                job.requirements,
            );

            await this.saveMatch(candidate.id, job.id, result);
        }

        return { calculated: candidates.length };
    }

    private calculateSkillScore(
        candidateSkills: CandidateSkillForMatching[],
        requirements: JobRequirementForMatching[],
    ) {
        const candidateSkillsById = new Map(
            candidateSkills.map((skill) => [skill.skillId, skill]),
        );

        let weightedScore = 0;
        let totalWeight = 0;

        const strengths: Array<Record<string, unknown>> = [];
        const gaps: Array<Record<string, unknown>> = [];

        for (const requirement of requirements) {
            const candidateSkill = candidateSkillsById.get(requirement.skillId);

            const defaultWeight = requirement.required ? 2 : 1;
            const configuredWeight = requirement.weight
                ? Number(requirement.weight)
                : defaultWeight;

            const weight =
                Number.isFinite(configuredWeight) && configuredWeight > 0
                    ? configuredWeight
                    : defaultWeight;

            const minimumLevel = Math.max(requirement.minimumLevel, 1);
            const candidateLevel = candidateSkill?.proficiencyLevel ?? null;

            const ratio = candidateLevel
                ? Math.min(candidateLevel / minimumLevel, 1)
                : 0;

            weightedScore += ratio * weight;
            totalWeight += weight;

            if (candidateLevel !== null && candidateLevel >= minimumLevel) {
                strengths.push({
                    skill: requirement.skill.name,
                    candidateLevel,
                    requiredLevel: minimumLevel,
                    required: requirement.required,
                });
            } else {
                gaps.push({
                    skill: requirement.skill.name,
                    candidateLevel,
                    requiredLevel: minimumLevel,
                    required: requirement.required,
                });
            }
        }

        const score =
            totalWeight > 0
                ? Math.round((weightedScore / totalWeight) * 10000) / 100
                : 0;

        return {
            score,
            explanation: {
                algorithm: 'weighted-skill-v1',
                strengths,
                gaps,
                requirementsCount: requirements.length,
            },
        };
    }

    private async saveMatch(
        candidateId: string,
        jobId: string,
        result: {
            score: number;
            explanation: {
                algorithm: string;
                strengths: Array<Record<string, unknown>>;
                gaps: Array<Record<string, unknown>>;
                requirementsCount: number;
            };
        },
    ) {
        const explanation = result.explanation as Prisma.InputJsonValue;

        await this.prisma.match.upsert({
            where: {
                candidateId_jobId: { candidateId, jobId },
            },
            create: {
                candidateId,
                jobId,
                overallScore: result.score,
                skillScore: result.score,
                explanation,
                calculatedAt: new Date(),
            },
            update: {
                overallScore: result.score,
                skillScore: result.score,
                explanation,
                calculatedAt: new Date(),
            },
        });
    }

    async getMyMatches(userId: string, page: number, limit: number) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate not found');
        }

        const now = new Date();
        const where = {
            candidateId: candidate.id,
            job: {
                status: JobStatus.PUBLISHED,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        };

        const [data, total] = await Promise.all([
            this.prisma.match.findMany({
                where,
                include: {
                    job: {
                        include: {
                            company: true,
                            requirements: {
                                include: {
                                    skill: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    { overallScore: 'desc' },
                    { calculatedAt: 'desc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.match.count({ where }),
        ]);

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getCandidatesForJob(
        userId: string,
        jobId: string,
        page: number,
        limit: number,
    ) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: { userId },
            select: { companyId: true },
        });

        if (!recruiter?.companyId) {
            throw new NotFoundException('Recruiter or company not found');
        }

        const now = new Date();

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                companyId: recruiter.companyId,
                status: JobStatus.PUBLISHED,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { id: true },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const where = { jobId: job.id };

        const [data, total] = await Promise.all([
            this.prisma.match.findMany({
                where,
                include: {
                    candidate: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                            candidateSkills: {
                                include: {
                                    skill: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    { overallScore: 'desc' },
                    { calculatedAt: 'desc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.match.count({ where }),
        ]);

        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getMyMatchForJob(userId: string, jobId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate not found');
        }

        const now = new Date();

        const job = await this.prisma.job.findFirst({
            where: {
                id: jobId,
                status: JobStatus.PUBLISHED,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
            select: { id: true },
        });

        if (!job) {
            throw new NotFoundException('Job not found');
        }

        const match = await this.prisma.match.findUnique({
            where: {
                candidateId_jobId: {
                    candidateId: candidate.id,
                    jobId: job.id,
                },
            },
        });

        return { data: match };
    }
}
