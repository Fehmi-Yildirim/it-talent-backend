import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60_000,
            limit: 100,
          },
          {
            name: 'authLogin',
            ttl: 60_000,
            limit: 5,
          },
          {
            name: 'authRegister',
            ttl: 60_000,
            limit: 3,
          },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
