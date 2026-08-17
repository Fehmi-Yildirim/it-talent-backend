import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GetSkillsDto } from './dto/get-skills.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(dto: GetSkillsDto) {
        return this.prisma.skill.findMany({
            where: {
                ...(dto.category && {
                    category: dto.category,
                }),
                ...(dto.search && {
                    OR: [
                        {
                            name: {
                                contains: dto.search,
                                mode: 'insensitive',
                            },
                        },
                        {
                            slug: {
                                contains: dto.search,
                                mode: 'insensitive',
                            },
                        },
                    ],
                }),
            },
            orderBy: {
                name: 'asc',
            },
            select: {
                id: true,
                name: true,
                slug: true,
                category: true,
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    async findOne(id: string) {
        const skill = await this.prisma.skill.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                category: true,
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!skill) {
            throw new NotFoundException('Skill not found');
        }

        return skill;
    }

    async create(dto: CreateSkillDto) {
        const existingSkill = await this.prisma.skill.findUnique({
            where: {
                slug: dto.slug,
            },
        });

        if (existingSkill) {
            throw new ConflictException('Skill with this slug already exists');
        }

        return this.prisma.skill.create({
            data: {
                name: dto.name,
                slug: dto.slug,
                category: dto.category,
                description: dto.description,
            },
        });
    }

    async update(id: string, dto: UpdateSkillDto) {
        await this.findOne(id);

        if (dto.slug) {
            const existingSkill = await this.prisma.skill.findUnique({
                where: {
                    slug: dto.slug,
                },
            });

            if (existingSkill && existingSkill.id !== id) {
                throw new ConflictException('Skill with this slug already exists');
            }
        }

        return this.prisma.skill.update({
            where: {
                id,
            },
            data: { ...dto },
        });
    }

    async remove(id: string) {
        await this.findOne(id);

        return this.prisma.skill.delete({
            where: {
                id,
            },
        });
    }
}