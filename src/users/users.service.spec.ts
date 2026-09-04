import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { UserRole, UserStatus } from '../../generated/prisma/enums';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('allows ADMIN to access any user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.findOne('user-1', 'admin-1', UserRole.ADMIN),
      ).resolves.toEqual(user);
    });

    it('allows a user to access their own account', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.findOne('user-1', 'user-1', UserRole.CANDIDATE),
      ).resolves.toEqual(user);
    });

    it('forbids a user from accessing another user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.findOne('user-1', 'user-2', UserRole.CANDIDATE),
      ).rejects.toThrow(
        new ForbiddenException(
          'You do not have permission to access this user',
        ),
      );
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('missing-user', 'user-1', UserRole.CANDIDATE),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });
  });

  describe('update', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.CANDIDATE,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('allows ADMIN to update any user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      await expect(
        service.update(
          'user-1',
          { email: 'new@example.com' },
          'admin-1',
          UserRole.ADMIN,
        ),
      ).resolves.toEqual(user);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('allows a user to update their own account', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      await expect(
        service.update(
          'user-1',
          { email: 'new@example.com' },
          'user-1',
          UserRole.CANDIDATE,
        ),
      ).resolves.toEqual(user);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('forbids a user from updating another user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.update(
          'user-1',
          { email: 'new@example.com' },
          'user-2',
          UserRole.CANDIDATE,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('forbids a non-ADMIN user from changing a role', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.update(
          'user-1',
          { role: UserRole.ADMIN },
          'user-1',
          UserRole.CANDIDATE,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('forbids a non-ADMIN user from changing status', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.update(
          'user-1',
          { status: user.status },
          'user-1',
          UserRole.CANDIDATE,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
