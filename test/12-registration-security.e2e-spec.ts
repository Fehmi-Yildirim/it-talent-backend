
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

interface RegisterResponse {
    accessToken: string;
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

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should reject registration when ADMIN role is supplied', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email: `admin-escalation-${Date.now()}@example.com`,
                password: 'SecurePassword123!',
                firstName: 'Test',
                lastName: 'Admin',
                role: 'ADMIN',
            })
            .expect(400);
    });

    it('should register a user as CANDIDATE by default', async () => {
        const email = `candidate-security-${Date.now()}@example.com`;

        const response = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
                email,
                password: 'SecurePassword123!',
                firstName: 'Test',
                lastName: 'Candidate',
            })
            .expect(201);

        const body = response.body as RegisterResponse;

        expect(body.accessToken).toEqual(expect.any(String));
        expect(body.user).toMatchObject({
            email,
            firstName: 'Test',
            lastName: 'Candidate',
            role: 'CANDIDATE',
            status: 'PENDING',
        });
    });
});
