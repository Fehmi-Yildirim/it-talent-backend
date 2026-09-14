import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { GetSkillsDto } from './dto/get-skills.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { generateSkillSlug } from './skill-slug.util';

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
    const slug = generateSkillSlug(dto.name);

    const existingSkill = await this.prisma.skill.findUnique({
      where: {
        slug,
      },
    });

    if (existingSkill) {
      throw new ConflictException('Skill with this slug already exists');
    }

    return this.prisma.skill.create({
      data: {
        name: dto.name,
        slug,
        category: dto.category,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateSkillDto) {
    const existingSkill = await this.findOne(id);

    const slug =
      dto.name !== undefined
        ? generateSkillSlug(dto.name)
        : existingSkill.slug;

    if (slug !== existingSkill.slug) {
      const skillWithSlug = await this.prisma.skill.findUnique({
        where: {
          slug,
        },
      });

      if (skillWithSlug && skillWithSlug.id !== id) {
        throw new ConflictException('Skill with this slug already exists');
      }
    }

    return this.prisma.skill.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),
        ...(dto.category !== undefined && {
          category: dto.category,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(slug !== existingSkill.slug && {
          slug,
        }),
      },
    });
  }

  async remove(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        _count: {
          select: {
            candidateSkills: true,
            jobRequirements: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    if (
      skill._count.candidateSkills > 0 ||
      skill._count.jobRequirements > 0
    ) {
      throw new ConflictException(
        'Skill cannot be deleted because it is still in use.',
      );
    }

    return this.prisma.skill.delete({
      where: {
        id,
      },
    });
  }
}