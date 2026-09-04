import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { CandidatesService } from './candidates.service';

describe('CandidatesService', () => {
  let service: CandidatesService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
  });

  describe('getMe', () => {
    it('should return the candidate profile for the authenticated user', async () => {
      const candidate = {
        id: 'candidate-1',
        userId: 'user-1',
        headline: 'Full Stack Developer',
      };

      prismaMock.candidate.findUnique.mockResolvedValue(candidate);

      const result = await service.getMe('user-1');

      expect(result).toEqual(candidate);
      expect(prismaMock.candidate.findUnique).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
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
    });

    it('should throw NotFoundException when the profile does not exist', async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      await expect(service.getMe('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      headline: 'Full Stack Developer',
      location: 'Rotterdam',
    };

    it('should create a candidate profile for the authenticated user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CANDIDATE',
      });

      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const candidate = {
        id: 'candidate-1',
        userId: 'user-1',
        ...dto,
      };

      prismaMock.candidate.create.mockResolvedValue(candidate);

      const result = await service.create('user-1', dto);

      expect(result).toEqual(candidate);
      expect(prismaMock.candidate.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          headline: 'Full Stack Developer',
          summary: undefined,
          location: 'Rotterdam',
          salaryMin: undefined,
          salaryMax: undefined,
          currency: undefined,
          availabilityDate: undefined,
          remotePreference: undefined,
        },
      });
    });

    it('should reject a non-existing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject users who are not candidates', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'RECRUITER',
      });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject duplicate candidate profiles', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CANDIDATE',
      });

      prismaMock.candidate.findUnique.mockResolvedValue({
        id: 'candidate-1',
        userId: 'user-1',
      });

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateMe', () => {
    it('should update the candidate profile belonging to the authenticated user', async () => {
      const existingCandidate = {
        id: 'candidate-1',
        userId: 'user-1',
      };

      const dto = {
        headline: 'Senior Full Stack Developer',
        location: 'Amsterdam',
      };

      const updatedCandidate = {
        ...existingCandidate,
        ...dto,
      };

      prismaMock.candidate.findUnique.mockResolvedValue(existingCandidate);
      prismaMock.candidate.update.mockResolvedValue(updatedCandidate);

      const result = await service.updateMe('user-1', dto);

      expect(result).toEqual(updatedCandidate);

      expect(prismaMock.candidate.findUnique).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
      });

      expect(prismaMock.candidate.update).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
        data: {
          headline: 'Senior Full Stack Developer',
          summary: undefined,
          location: 'Amsterdam',
          salaryMin: undefined,
          salaryMax: undefined,
          currency: undefined,
          availabilityDate: undefined,
          remotePreference: undefined,
        },
      });
    });

    it('should throw NotFoundException when the profile does not exist', async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMe('user-1', {
          headline: 'New headline',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
