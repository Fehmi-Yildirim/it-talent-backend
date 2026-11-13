import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';

export async function createTestApp(options: { disableRateLimit?: boolean } = {}): Promise<INestApplication> {
  const testingModule = Test.createTestingModule({
    imports: [AppModule],
  });

  if (options.disableRateLimit) {
    testingModule.overrideGuard(ThrottlerGuard).useValue({
      canActivate: () => true,
    });
  }

  const moduleFixture = await testingModule.compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  return app;
}
