import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

describe('13 - Authentication rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should limit login requests despite spoofed X-Forwarded-For headers', async () => {
    for (let i = 1; i <= 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i}`)
        .send({})
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({})
      .expect(429);
  });

  it('should limit registration requests', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({})
      .expect(429);
  });
});
