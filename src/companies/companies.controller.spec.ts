import { Test, TestingModule } from '@nestjs/testing';

import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;

  const companiesService = {
    create: jest.fn(),
    getMyCompany: jest.fn(),
    updateMyCompany: jest.fn(),
  };

  const user = {
    id: 'user-1',
    email: 'recruiter@example.com',
    role: 'RECRUITER',
    status: 'ACTIVE',
  };

  type ControllerRequest = Parameters<CompaniesController['create']>[0];

  const request = {
    user,
  } as ControllerRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: companiesService,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a company for the authenticated user', async () => {
    const dto = {
      name: 'Acme',
      description: 'Acme description',
    };

    const company = {
      id: 'company-1',
      name: 'Acme',
    };

    companiesService.create.mockResolvedValue(company);

    const result = await controller.create(request, dto);

    expect(companiesService.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(company);
  });

  it('should return the authenticated user company', async () => {
    const company = {
      id: 'company-1',
      name: 'Acme',
    };

    companiesService.getMyCompany.mockResolvedValue(company);

    const result = await controller.getMyCompany(request);

    expect(companiesService.getMyCompany).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(company);
  });

  it('should update the authenticated user company', async () => {
    const dto = {
      name: 'Updated Acme',
      description: 'Updated description',
    };

    const company = {
      id: 'company-1',
      name: 'Updated Acme',
    };

    companiesService.updateMyCompany.mockResolvedValue(company);

    const result = await controller.updateMyCompany(request, dto);

    expect(companiesService.updateMyCompany).toHaveBeenCalledWith(
      'user-1',
      dto,
    );
    expect(result).toEqual(company);
  });
});