
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

interface RegistrationResponse {
    user: {
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        status: string;
    };
}

describe('12 - Registration security (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        app = await createTestApp({ disableRateLimit: true });
    });

    afterEach(async () => {
        await app.close();
    });

    it('should reject registration with ADMIN role', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: `admin-${Date.now()}@example.com`,
                password: 'SecurePassword123!',
                firstName: 'Test',
                lastName: 'Admin',
                role: 'ADMIN',
            })
            .expect(400);
    });

    it('should reject registration without a role', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: `missing-role-${Date.now()}@example.com`,
                password: 'SecurePassword123!',
                firstName: 'Test',
                lastName: 'User',
            })
            .expect(400);
    });

    it.each(['CANDIDATE', 'RECRUITER'])(
        'should register a %s with PENDING status and no access token',
        async (role) => {
            const email = `${role.toLowerCase()}-${Date.now()}@example.com`;

            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/register')
                .send({
                    email,
                    password: 'SecurePassword123!',
                    firstName: 'Test',
                    lastName: 'User',
                    role,
                })
                .expect(201);

            const body = response.body as RegistrationResponse;

            expect(body.user).toMatchObject({
                email,
                firstName: 'Test',
                lastName: 'User',
                role,
                status: 'PENDING',
            });

            expect(body).not.toHaveProperty('accessToken');
        },
    );

    it('should reject login while the account is PENDING', async () => {
        const email = `pending-${Date.now()}@example.com`;
        const password = 'SecurePassword123!';

        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email,
                password,
                firstName: 'Pending',
                lastName: 'User',
                role: 'CANDIDATE',
            })
            .expect(201);

        await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email, password })
            .expect(401);
    });
});
