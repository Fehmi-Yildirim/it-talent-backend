import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto';

@Injectable()
export class RecruitersService {
    constructor(private readonly prisma: PrismaService) { }

    async getMe(userId: string) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
        });

        if (!recruiter) {
            throw new NotFoundException('Recruiter profile not found');
        }

        return recruiter;
    }

    async updateMe(userId: string, dto: UpdateRecruiterDto) {
        const recruiter = await this.prisma.recruiter.findUnique({
            where: {
                userId,
            },
        });

        if (!recruiter) {
            throw new NotFoundException('Recruiter profile not found');
        }

        return this.prisma.recruiter.update({
            where: {
                id: recruiter.id,
            },
            data: {
                ...(dto.jobTitle !== undefined && {
                    jobTitle: dto.jobTitle.trim(),
                }),
            },
        });
    }
}