
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';

describe('13 - User security (e2e)', () => {
    let app: INestApplication;
    let adminToken: string;
    let candidateToken: string;
    let candidateId: string;

    beforeAll(async () => {
        app = await createTestApp();

        // Authenticate as the existing administrator.
        const adminLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@example.com',
                password: 'Admin12345!',
            })
            .expect(201);

        adminToken = adminLogin.body.accessToken;

        // Register a separate candidate for these tests.
        const registration = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: `user-security-${Date.now()}@example.com`,
                password: 'SecurePassword123!',
                firstName: 'Security',
                lastName: 'Candidate',
            })
            .expect(201);

        candidateToken = registration.body.accessToken;
        candidateId = registration.body.user.id;

        expect(candidateToken).toEqual(expect.any(String));
        expect(candidateId).toEqual(expect.any(String));

        await request(app.getHttpServer())
            .patch(`/api/v1/users/${candidateId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'ACTIVE' })
            .expect(200);
    });

    afterAll(async () => {
        // Clean up the test candidate using the administrator account.
        if (adminToken && candidateId) {
            await request(app.getHttpServer())
                .delete(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${adminToken}`);
        }

        await app.close();
    });

    describe('Role-based access control', () => {
        it('rejects a candidate requesting the users list', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(403);
        });

        it('rejects a candidate creating a user', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({})
                .expect(403);
        });

        it('rejects a candidate deleting a user', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(403);
        });

        it('allows an administrator to list users', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        it('allows an administrator to view another user', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: candidateId,
                role: 'CANDIDATE',
            });
        });
    });

    describe('Privilege escalation protection', () => {
        it('rejects a candidate promoting themselves through PATCH /users/me', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({ role: 'ADMIN' })
                .expect(403);
        });

        it('rejects a candidate changing their status through PATCH /users/me', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({ status: 'ACTIVE' })
                .expect(403);
        });

        it('rejects a candidate promoting themselves through PATCH /users/:id', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({ role: 'ADMIN' })
                .expect(403);
        });

        it('rejects a candidate changing their status through PATCH /users/:id', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({ status: 'ACTIVE' })
                .expect(403);
        });
    });

    describe('User privacy', () => {
        it('rejects a candidate accessing another user account', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/users')
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(403);
        });

        it('allows a candidate to access their own account', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/users/${candidateId}`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: candidateId,
                role: 'CANDIDATE',
            });
        });
    });
});
