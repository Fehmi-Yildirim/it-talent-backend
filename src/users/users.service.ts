import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        candidate: {
          select: {
            id: true,
            headline: true,
            summary: true,
            location: true,
            salaryMin: true,
            salaryMax: true,
            currency: true,
            availabilityDate: true,
            remotePreference: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        recruiter: {
          select: {
            id: true,
            companyId: true,
            jobTitle: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createCandidateProfile(
    userId: string,
    dto: CreateCandidateProfileDto,
  ) {
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
        'Only candidates can create a candidate profile',
      );
    }

    const existingCandidate = await this.prisma.candidate.findUnique({
      where: { userId },
    });

    if (existingCandidate) {
      throw new ConflictException('Candidate profile already exists');
    }

    return this.prisma.candidate.create({
      data: {
        userId,
        headline: dto.headline,
        summary: dto.summary,
        location: dto.location,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        currency: dto.currency,
        availabilityDate: dto.availabilityDate
          ? new Date(dto.availabilityDate)
          : undefined,
        remotePreference: dto.remotePreference,
      },
    });
  }
}
