import { Test, TestingModule } from '@nestjs/testing';

import { UserRole, UserStatus } from '../../generated/prisma/enums';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getMe: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  type ControllerRequest = Parameters<UsersController['getMe']>[0];

  beforeEach(async () => {
    usersService = {
      getMe: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('passes the authenticated user id to the service', async () => {
      const req = {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
        },
      } as ControllerRequest;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      usersService.getMe.mockResolvedValue(result);

      await expect(controller.getMe(req)).resolves.toEqual(result);

      expect(usersService.getMe).toHaveBeenCalledWith('user-1');
    });
  });

  describe('create', () => {
    it('passes the DTO to the service', async () => {
      const dto = {
        email: 'user@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.CANDIDATE,
        status: UserStatus.ACTIVE,
      };

      const result = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      usersService.create.mockResolvedValue(result);

      await expect(controller.create(dto)).resolves.toEqual(result);

      expect(usersService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('calls the service', async () => {
      const result = [
        {
          id: 'user-1',
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      ];

      usersService.findAll.mockResolvedValue(result);

      await expect(controller.findAll()).resolves.toEqual(result);

      expect(usersService.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('passes id, authenticated user id and role to the service', async () => {
      const req = {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
        },
      } as ControllerRequest;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      usersService.findOne.mockResolvedValue(result);

      await expect(controller.findOne('user-1', req)).resolves.toEqual(result);

      expect(usersService.findOne).toHaveBeenCalledWith(
        'user-1',
        'user-1',
        UserRole.CANDIDATE,
      );
    });
  });

  describe('update', () => {
    it('passes id, DTO, authenticated user id and role to the service', async () => {
      const req = {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: UserRole.CANDIDATE,
          status: UserStatus.ACTIVE,
        },
      } as ControllerRequest;

      const dto = {
        firstName: 'Updated',
        lastName: 'User',
      };

      const result = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Updated',
        lastName: 'User',
      };

      usersService.update.mockResolvedValue(result);

      await expect(
        controller.update('user-1', dto, req),
      ).resolves.toEqual(result);

      expect(usersService.update).toHaveBeenCalledWith(
        'user-1',
        dto,
        'user-1',
        UserRole.CANDIDATE,
      );
    });
  });

  describe('remove', () => {
    it('passes id and authenticated user id to the service', async () => {
      const req = {
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
      } as ControllerRequest;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      usersService.remove.mockResolvedValue(result);

      await expect(controller.remove('user-1', req)).resolves.toEqual(result);

      expect(usersService.remove).toHaveBeenCalledWith('user-1', 'admin-1');
    });
  });
});
