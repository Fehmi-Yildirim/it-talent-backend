/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';

describe('03 - Admin protection (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin12345!',
      })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
    adminId = loginResponse.body.user.id;

    expect(accessToken).toEqual(expect.any(String));
    expect(adminId).toEqual(expect.any(String));
  });

  it('should not allow the last ADMIN to delete themselves', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(response.body.message).toBe(
      'The last administrator cannot be deleted',
    );
  });

  it('should not allow the last ADMIN to change their own role', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        role: 'CANDIDATE',
      })
      .expect(403);

    expect(response.body.message).toBe(
      'The last administrator cannot change their role',
    );
  });

  it('should still be ADMIN after the blocked operations', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: adminId,
      email: 'admin@example.com',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app.close();
  });
});