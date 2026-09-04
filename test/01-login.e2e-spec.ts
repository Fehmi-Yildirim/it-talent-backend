import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

interface LoginResponse {
  accessToken: string;
  user: {
    email: string;
    role: string;
    status: string;
  };
}

describe('01 - Login (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should login the admin successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin12345!',
      })
      .expect(201);

    const body = response.body as LoginResponse;

    expect(body).toHaveProperty('accessToken');
    expect(body.accessToken).toEqual(expect.any(String));

    expect(body.user).toMatchObject({
      email: 'admin@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });

  afterAll(async () => {
    await app.close();
  });
});