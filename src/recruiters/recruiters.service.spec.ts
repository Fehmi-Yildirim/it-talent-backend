import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { RecruitersService } from './recruiters.service';

describe('RecruitersService', () => {
    let service: RecruitersService;

    const prismaMock = {
        recruiter: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RecruitersService,
                {
                    provide: PrismaService,
                    useValue: prismaMock,
                },
            ],
        }).compile();

        service = module.get<RecruitersService>(RecruitersService);
    });

    describe('getMe', () => {
        it('should return the authenticated recruiter profile', async () => {
            const recruiter = {
                id: 'recruiter-id',
                userId: 'user-id',
                companyId: 'company-id',
                jobTitle: 'Senior Recruiter',
            };

            prismaMock.recruiter.findUnique.mockResolvedValue(recruiter);

            const result = await service.getMe('user-id');

            expect(result).toEqual(recruiter);

            expect(prismaMock.recruiter.findUnique).toHaveBeenCalledWith({
                where: {
                    userId: 'user-id',
                },
            });
        });

        it('should throw NotFoundException when the recruiter profile does not exist', async () => {
            prismaMock.recruiter.findUnique.mockResolvedValue(null);

            await expect(service.getMe('unknown-user-id')).rejects.toThrow(
                new NotFoundException('Recruiter profile not found'),
            );
        });
    });

    describe('updateMe', () => {
        it('should update the authenticated recruiter profile', async () => {
            const recruiter = {
                id: 'recruiter-id',
                userId: 'user-id',
                companyId: 'company-id',
                jobTitle: 'Recruiter',
            };

            const updatedRecruiter = {
                ...recruiter,
                jobTitle: 'Senior Recruiter',
            };

            prismaMock.recruiter.findUnique.mockResolvedValue(recruiter);
            prismaMock.recruiter.update.mockResolvedValue(updatedRecruiter);

            const result = await service.updateMe('user-id', {
                jobTitle: 'Senior Recruiter',
            });

            expect(result).toEqual(updatedRecruiter);

            expect(prismaMock.recruiter.update).toHaveBeenCalledWith({
                where: {
                    id: 'recruiter-id',
                },
                data: {
                    jobTitle: 'Senior Recruiter',
                },
            });
        });

        it('should throw NotFoundException when the recruiter profile does not exist', async () => {
            prismaMock.recruiter.findUnique.mockResolvedValue(null);

            await expect(
                service.updateMe('unknown-user-id', {
                    jobTitle: 'Senior Recruiter',
                }),
            ).rejects.toThrow(
                new NotFoundException('Recruiter profile not found'),
            );

            expect(prismaMock.recruiter.update).not.toHaveBeenCalled();
        });
    });
});