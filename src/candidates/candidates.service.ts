import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
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
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    return candidate;
  }

  async create(userId: string, dto: CreateCandidateDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
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
      where: {
        userId,
      },
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

  async updateMe(userId: string, dto: UpdateCandidateDto) {
    const candidate = await this.prisma.candidate.findUnique({
      where: {
        userId,
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    return this.prisma.candidate.update({
      where: {
        userId,
      },
      data: {
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
