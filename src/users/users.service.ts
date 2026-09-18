import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { UserRole } from '../../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
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
        firstName: true,
        lastName: true,
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
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        status: dto.status,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
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
        firstName: true,
        lastName: true,
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

  async findOne(
    id: string,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = requestingUserRole === UserRole.ADMIN;
    const isOwner = requestingUserId === id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'You do not have permission to access this user',
      );
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    const user = await this.findOne(id, requestingUserId, requestingUserRole);

    const data: {
      email?: string;
      passwordHash?: string;
      firstName?: string;
      lastName?: string;
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

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim();
    }

    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName.trim();
    }

    if (dto.role !== undefined) {
      // Only ADMIN users may change roles.
      if (requestingUserRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only administrators can change user roles',
        );
      }

      // Prevent the last ADMIN from losing the ADMIN role.
      if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
        const adminCount = await this.prisma.user.count({
          where: {
            role: UserRole.ADMIN,
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
      // Only ADMIN users may change user status.
      if (requestingUserRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only administrators can change user status',
        );
      }

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
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, _requestingUserId: string) {
    const user = await this.findOne(id, _requestingUserId, UserRole.ADMIN);

    // Never allow the last ADMIN to be deleted.
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
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
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });
  }
}
