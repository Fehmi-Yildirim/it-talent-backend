import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/enums';
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
          role: UserRole.CANDIDATE,
        },
      } as any;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
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
        role: UserRole.CANDIDATE,
        status: 'ACTIVE',
      };

      const result = {
        id: 'user-1',
        email: 'user@example.com',
      };

      usersService.create.mockResolvedValue(result);

      await expect(controller.create(dto as any)).resolves.toEqual(result);

      expect(usersService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('calls the service', async () => {
      const result = [
        {
          id: 'user-1',
          email: 'user@example.com',
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
          role: UserRole.CANDIDATE,
        },
      } as any;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
      };

      usersService.findOne.mockResolvedValue(result);

      await expect(
        controller.findOne('user-1', req),
      ).resolves.toEqual(result);

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
          role: UserRole.CANDIDATE,
        },
      } as any;

      const dto = {
        email: 'new@example.com',
      };

      const result = {
        id: 'user-1',
        email: 'new@example.com',
      };

      usersService.update.mockResolvedValue(result);

      await expect(
        controller.update('user-1', dto as any, req),
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
          role: UserRole.ADMIN,
        },
      } as any;

      const result = {
        id: 'user-1',
        email: 'user@example.com',
      };

      usersService.remove.mockResolvedValue(result);

      await expect(
        controller.remove('user-1', req),
      ).resolves.toEqual(result);

      expect(usersService.remove).toHaveBeenCalledWith(
        'user-1',
        'admin-1',
      );
    });
  });
});
