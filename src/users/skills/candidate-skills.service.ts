import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CreateCandidateSkillDto } from './dto/create-candidate-skill.dto';
import { UpdateCandidateSkillDto } from './dto/update-candidate-skill.dto';
import { CandidateSkillSource } from '../../../generated/prisma/enums';

@Injectable()
export class CandidateSkillsService {
    constructor(private readonly prisma: PrismaService) { }

    async findMine(userId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: {
                userId,
            },
            select: {
                id: true,
            },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate profile not found');
        }

        return this.prisma.candidateSkill.findMany({
            where: {
                candidateId: candidate.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                skill: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        category: true,
                        description: true,
                    },
                },
            },
        });
    }

    async create(userId: string, dto: CreateCandidateSkillDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== 'CANDIDATE') {
            throw new ForbiddenException(
                'Only candidates can manage candidate skills',
            );
        }

        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: {
                id: true,
            },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate profile not found');
        }

        const skill = await this.prisma.skill.findUnique({
            where: { id: dto.skillId },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });

        if (!skill) {
            throw new NotFoundException('Skill not found');
        }

        const existingCandidateSkill =
            await this.prisma.candidateSkill.findUnique({
                where: {
                    candidateId_skillId: {
                        candidateId: candidate.id,
                        skillId: skill.id,
                    },
                },
            });

        if (existingCandidateSkill) {
            throw new ConflictException(
                'Candidate already has this skill',
            );
        }

        return this.prisma.candidateSkill.create({
            data: {
                candidateId: candidate.id,
                skillId: skill.id,
                proficiencyLevel: dto.proficiencyLevel,
                yearsOfExperience: dto.yearsOfExperience,
                source: CandidateSkillSource.SELF_REPORTED,
            },
            include: {
                skill: true,
            },
        });
    }

    async updateMine(
        userId: string,
        skillId: string,
        dto: UpdateCandidateSkillDto,
    ) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate profile not found');
        }

        const candidateSkill = await this.prisma.candidateSkill.findUnique({
            where: {
                candidateId_skillId: {
                    candidateId: candidate.id,
                    skillId,
                },
            },
        });

        if (!candidateSkill) {
            throw new NotFoundException('Candidate skill not found');
        }

        return this.prisma.candidateSkill.update({
            where: {
                id: candidateSkill.id,
            },
            data: {
                proficiencyLevel: dto.proficiencyLevel,
                yearsOfExperience: dto.yearsOfExperience,
            },
            include: {
                skill: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        category: true,
                        description: true,
                    },
                },
            },
        });
    }

    async removeMine(userId: string, skillId: string) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!candidate) {
            throw new NotFoundException('Candidate profile not found');
        }

        const candidateSkill = await this.prisma.candidateSkill.findUnique({
            where: {
                candidateId_skillId: {
                    candidateId: candidate.id,
                    skillId,
                },
            },
            select: {
                id: true,
            },
        });

        if (!candidateSkill) {
            throw new NotFoundException('Candidate skill not found');
        }

        await this.prisma.candidateSkill.delete({
            where: {
                id: candidateSkill.id,
            },
        });

        return {
            message: 'Candidate skill deleted successfully',
        };
    }
}

