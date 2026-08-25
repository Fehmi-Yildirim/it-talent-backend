import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { PrismaService } from '../database/prisma.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async getMyCandidateProfile(userId: string) {
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

  async createCandidateProfile(
    userId: string,
    dto: CreateCandidateProfileDto,
  ) {
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

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException('Unable to create user');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        status: dto.status,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    const data: {
      email?: string;
      passwordHash?: string;
      role?: CreateUserDto['role'];
      status?: CreateUserDto['status'];
    } = {};

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();

      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Unable to update user');
      }

      data.email = email;
    }

    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password);
    }

    if (dto.role !== undefined) {
      // Prevent the last ADMIN from losing the ADMIN role.
      if (user.role === 'ADMIN' && dto.role !== 'ADMIN') {
        const adminCount = await this.prisma.user.count({
          where: {
            role: 'ADMIN',
          },
        });

        if (adminCount <= 1) {
          throw new ForbiddenException(
            'The last administrator cannot change their role',
          );
        }
      }

      data.role = dto.role;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.user.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, _requestingUserId: string) {
    const user = await this.findOne(id);

    // Never allow the last ADMIN to be deleted.
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: {
          role: 'ADMIN',
        },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException(
          'The last administrator cannot be deleted',
        );
      }
    }

    return this.prisma.user.delete({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });
  }
}