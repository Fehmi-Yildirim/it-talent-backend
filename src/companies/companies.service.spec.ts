import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { CompaniesService } from './companies.service';

interface PrismaMock {
  $transaction: jest.Mock;
  recruiter: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  company: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
}

describe('CompaniesService', () => {
  let service: CompaniesService;

  const prisma: PrismaMock = {
    $transaction: jest.fn(),
    recruiter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    company: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);

    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(
      (callback: (tx: PrismaMock) => unknown) => callback(prisma),
    );
  });

  describe('create', () => {
    it('should create a company for a recruiter and assign it', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        id: 'recruiter-1',
        companyId: null,
      });

      prisma.company.findUnique.mockResolvedValue(null);

      prisma.company.create.mockResolvedValue({
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        description: 'Acme description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      prisma.recruiter.update.mockResolvedValue({
        id: 'recruiter-1',
        companyId: 'company-1',
      });

      const result = await service.create('user-1', {
        name: '  Acme  ',
        description: '  Acme description  ',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme',
          slug: 'acme',
          description: 'Acme description',
          website: 'https://acme.com',
          location: 'Amsterdam',
        },
      });

      expect(prisma.recruiter.update).toHaveBeenCalledWith({
        where: {
          id: 'recruiter-1',
        },
        data: {
          companyId: 'company-1',
        },
      });

      expect(result).toEqual({
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        description: 'Acme description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });
    });

    it('should create a company without optional website and location', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        id: 'recruiter-1',
        companyId: null,
      });

      prisma.company.findUnique.mockResolvedValue(null);

      prisma.company.create.mockResolvedValue({
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        description: 'Description',
        website: null,
        location: null,
      });

      prisma.recruiter.update.mockResolvedValue({
        id: 'recruiter-1',
        companyId: 'company-1',
      });

      const result = await service.create('user-1', {
        name: 'Acme',
        description: 'Description',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme',
          slug: 'acme',
          description: 'Description',
          website: null,
          location: null,
        },
      });

      expect(result).toEqual({
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        description: 'Description',
        website: null,
        location: null,
      });
    });

    it('should reject a user who is not a recruiter', async () => {
      prisma.recruiter.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          name: 'Acme',
          description: 'Description',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only recruiters can create a company'),
      );

      expect(prisma.company.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject a recruiter who already has a company', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        id: 'recruiter-1',
        companyId: 'existing-company',
      });

      await expect(
        service.create('user-1', {
          name: 'Acme',
          description: 'Description',
        }),
      ).rejects.toThrow(
        new ConflictException('Recruiter is already assigned to a company'),
      );

      expect(prisma.company.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create a unique slug when the base slug already exists', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        id: 'recruiter-1',
        companyId: null,
      });

      prisma.company.findUnique
        .mockResolvedValueOnce({
          id: 'existing-company',
        })
        .mockResolvedValueOnce(null);

      prisma.company.create.mockResolvedValue({
        id: 'company-1',
        name: 'Acme',
        slug: 'acme-1',
        description: 'Description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      prisma.recruiter.update.mockResolvedValue({
        id: 'recruiter-1',
        companyId: 'company-1',
      });

      await service.create('user-1', {
        name: 'Acme',
        description: 'Description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      expect(prisma.company.findUnique).toHaveBeenNthCalledWith(1, {
        where: {
          slug: 'acme',
        },
        select: {
          id: true,
        },
      });

      expect(prisma.company.findUnique).toHaveBeenNthCalledWith(2, {
        where: {
          slug: 'acme-1',
        },
        select: {
          id: true,
        },
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme',
          slug: 'acme-1',
          description: 'Description',
          website: 'https://acme.com',
          location: 'Amsterdam',
        },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMyCompany', () => {
    it('should reject a user who is not a recruiter', async () => {
      prisma.recruiter.findUnique.mockResolvedValue(null);

      await expect(service.getMyCompany('user-1')).rejects.toThrow(
        new ForbiddenException('Only recruiters can access a company'),
      );
    });

    it('should reject a recruiter without a company', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        company: null,
      });

      await expect(service.getMyCompany('user-1')).rejects.toThrow(
        new NotFoundException('Recruiter is not assigned to a company'),
      );
    });

    it('should return the recruiter company', async () => {
      const company = {
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
        description: 'Description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      };

      prisma.recruiter.findUnique.mockResolvedValue({
        company,
      });

      const result = await service.getMyCompany('user-1');

      expect(result).toEqual(company);

      expect(prisma.recruiter.findUnique).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
        },
        select: {
          company: true,
        },
      });
    });
  });

  describe('updateMyCompany', () => {
    it('should reject a user who is not a recruiter', async () => {
      prisma.recruiter.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMyCompany('user-1', {
          name: 'Updated Acme',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only recruiters can update a company'),
      );
    });

    it('should reject a recruiter without a company', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        companyId: null,
      });

      await expect(
        service.updateMyCompany('user-1', {
          name: 'Updated Acme',
        }),
      ).rejects.toThrow(
        new NotFoundException('Recruiter is not assigned to a company'),
      );
    });

    it('should update the recruiter company', async () => {
      prisma.recruiter.findUnique.mockResolvedValue({
        companyId: 'company-1',
      });

      prisma.company.update.mockResolvedValue({
        id: 'company-1',
        name: 'Updated Acme',
        slug: 'acme',
        description: 'Updated description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      const result = await service.updateMyCompany('user-1', {
        name: '  Updated Acme  ',
        description: '  Updated description  ',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: {
          id: 'company-1',
        },
        data: {
          name: 'Updated Acme',
          description: 'Updated description',
          website: 'https://acme.com',
          location: 'Amsterdam',
        },
      });

      expect(result).toEqual({
        id: 'company-1',
        name: 'Updated Acme',
        slug: 'acme',
        description: 'Updated description',
        website: 'https://acme.com',
        location: 'Amsterdam',
      });
    });
  });
});
