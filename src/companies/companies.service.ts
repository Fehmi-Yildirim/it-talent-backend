import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateCompanyDto) {
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
            throw new ForbiddenException(
                'Only recruiters can create a company',
            );
        }

        if (recruiter.companyId) {
            throw new ConflictException(
                'Recruiter is already assigned to a company',
            );
        }

        const name = dto.name.trim();

        return this.prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name,
                    slug: await this.createUniqueSlug(name, tx),
                    description: dto.description.trim(),
                },
            });

            await tx.recruiter.update({
                where: {
                    id: recruiter.id,
                },
                data: {
                    companyId: company.id,
                },
            });

            return company;
        });
    }

    private async createUniqueSlug(
        name: string,
        prisma: Pick<PrismaService, 'company'> = this.prisma,
    ) {
        const baseSlug = name
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'company';

        let suffix = 0;

        while (true) {
            const slug = suffix ? `${baseSlug}-${suffix}` : baseSlug;

            const existingCompany = await prisma.company.findUnique({
                where: { slug },
                select: { id: true },
            });

            if (!existingCompany) {
                return slug;
            }

            suffix += 1;
        }
    }

    async getMyCompany(userId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
            select: {
                company: true,
            },
        });

        if (!recruiter) {
            throw new ForbiddenException(
                'Only recruiters can access a company',
            );
        }

        if (!recruiter.company) {
            throw new NotFoundException(
                'Recruiter is not assigned to a company',
            );
        }

        return recruiter.company;
    }

    async updateMyCompany(
        userId: string,
        dto: UpdateCompanyDto,
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
                'Only recruiters can update a company',
            );
        }

        if (!recruiter.companyId) {
            throw new NotFoundException(
                'Recruiter is not assigned to a company',
            );
        }

        return this.prisma.company.update({
            where: {
                id: recruiter.companyId,
            },
            data: {
                ...(dto.name !== undefined && {
                    name: dto.name.trim(),
                }),
                ...(dto.description !== undefined && {
                    description: dto.description.trim(),
                }),
            },
        });
    }
}