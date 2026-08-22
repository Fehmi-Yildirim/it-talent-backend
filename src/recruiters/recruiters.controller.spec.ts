import { Test, TestingModule } from '@nestjs/testing';

import { RecruitersController } from './recruiters.controller';
import { RecruitersService } from './recruiters.service';

describe('RecruitersController', () => {
    let controller: RecruitersController;

    const recruitersService = {
        getMe: jest.fn(),
        updateMe: jest.fn(),
    };

    const user = {
        id: 'recruiter-user-id',
        email: 'recruiter@example.com',
        role: 'RECRUITER',
        status: 'ACTIVE',
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RecruitersController],
            providers: [
                {
                    provide: RecruitersService,
                    useValue: recruitersService,
                },
            ],
        }).compile();

        controller = module.get<RecruitersController>(
            RecruitersController,
        );
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should get the authenticated recruiter profile', async () => {
        const expectedRecruiter = {
            id: 'recruiter-id',
            userId: user.id,
            jobTitle: 'Senior Recruiter',
        };

        recruitersService.getMe.mockResolvedValue(expectedRecruiter);

        const result = await controller.getMe({ user } as any);

        expect(recruitersService.getMe).toHaveBeenCalledWith(user.id);
        expect(result).toEqual(expectedRecruiter);
    });

    it('should update the authenticated recruiter profile', async () => {
        const dto = {
            jobTitle: 'Recruitment Manager',
        };

        const expectedRecruiter = {
            id: 'recruiter-id',
            userId: user.id,
            jobTitle: 'Recruitment Manager',
        };

        recruitersService.updateMe.mockResolvedValue(expectedRecruiter);

        const result = await controller.updateMe(
            { user } as any,
            dto,
        );

        expect(recruitersService.updateMe).toHaveBeenCalledWith(
            user.id,
            dto,
        );

        expect(result).toEqual(expectedRecruiter);
    });
});