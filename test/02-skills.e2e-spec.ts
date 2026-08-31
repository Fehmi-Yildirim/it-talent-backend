
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

describe('02 - Skills (e2e)', () => {
    let app: INestApplication;

    let candidateAccessToken: string;
    let adminAccessToken: string;

    let skillId: string;
    let skillSlug: string;

    beforeAll(async () => {
        app = await createTestApp();

        /*
         * Gebruik bestaande E2E-accounts uit de lokale database.
         *
         * Candidate:
         *   candidate@example.com
         *   Candidate12345!
         *
         * Admin:
         *   admin@example.com
         *   Admin12345!
         */

        const candidateLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'candidate@example.com',
                password: 'Candidate12345!',
            })
            .expect(201);

        candidateAccessToken = candidateLogin.body.accessToken;

        expect(candidateAccessToken).toEqual(expect.any(String));

        const adminLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@example.com',
                password: 'Admin12345!',
            })
            .expect(201);

        adminAccessToken = adminLogin.body.accessToken;

        expect(adminAccessToken).toEqual(expect.any(String));

        /*
         * Maak één unieke skill.
         */
        skillSlug = `e2e-skill-${Date.now()}`;

        const createResponse = await request(app.getHttpServer())
            .post('/api/v1/skills')
            .set('Authorization', `Bearer ${adminAccessToken}`)
            .send({
                name: 'E2E Test Skill',
                slug: skillSlug,
                category: 'BACKEND',
                description: 'Skill created for E2E tests',
            });

        if (createResponse.status !== 201) {
            throw new Error(
                [
                    'E2E skill setup failed.',
                    'Expected: 201',
                    `Received: ${createResponse.status}`,
                    `Response: ${JSON.stringify(createResponse.body)}`,
                ].join('\n'),
            );
        }

        skillId = createResponse.body.id;

        expect(skillId).toEqual(expect.any(String));
    });

    afterAll(async () => {
        await app.close();
    });

    describe('GET /api/v1/skills', () => {
        it('should require authentication', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/skills')
                .expect(401);
        });

        it('should allow authenticated users to list skills', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/skills')
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should support search filtering', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/skills')
                .query({
                    search: 'E2E Test Skill',
                })
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);

            expect(
                response.body.some(
                    (skill: { id: string }) => skill.id === skillId,
                ),
            ).toBe(true);
        });

        it('should reject an invalid category filter', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/skills')
                .query({
                    category: 'INVALID_CATEGORY',
                })
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(400);
        });
    });

    describe('POST /api/v1/skills', () => {
        it('should reject unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/skills')
                .send({
                    name: 'Unauthorized Skill',
                    slug: `unauthorized-${Date.now()}`,
                    category: 'BACKEND',
                    description: 'Should not be created',
                })
                .expect(401);
        });

        it('should reject non-admin users', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/skills')
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .send({
                    name: 'Candidate Skill',
                    slug: `candidate-${Date.now()}`,
                    category: 'BACKEND',
                    description: 'Candidate must not create skills',
                })
                .expect(403);
        });

        it('should reject an invalid payload', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/skills')
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    name: '',
                    slug: '',
                    category: 'INVALID_CATEGORY',
                })
                .expect(400);
        });

        it('should allow ADMIN to create a skill', async () => {
            const slug = `created-by-admin-${Date.now()}`;

            const response = await request(app.getHttpServer())
                .post('/api/v1/skills')
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    name: 'Created By Admin',
                    slug,
                    category: 'BACKEND',
                    description: 'Created by E2E admin test',
                })
                .expect(201);

            expect(response.body).toMatchObject({
                name: 'Created By Admin',
                slug,
                category: 'BACKEND',
            });

            expect(response.body.id).toEqual(expect.any(String));
        });

        it('should reject a duplicate slug', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/skills')
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    name: 'Duplicate Skill',
                    slug: skillSlug,
                    category: 'BACKEND',
                    description: 'Duplicate slug',
                })
                .expect(409);
        });
    });

    describe('GET /api/v1/skills/:id', () => {
        it('should require authentication', async () => {
            await request(app.getHttpServer())
                .get(`/api/v1/skills/${skillId}`)
                .expect(401);
        });

        it('should allow authenticated users to get a skill', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(200);

            expect(response.body).toMatchObject({
                id: skillId,
                name: 'E2E Test Skill',
                slug: skillSlug,
                category: 'BACKEND',
            });
        });

        it('should return 404 for a non-existing skill', async () => {
            const nonExistingSkillId =
                '00000000-0000-4000-8000-000000000000';

            await request(app.getHttpServer())
                .get(`/api/v1/skills/${nonExistingSkillId}`)
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(404);
        });
    });

    describe('PATCH /api/v1/skills/:id', () => {
        it('should reject unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/skills/${skillId}`)
                .send({
                    description: 'Unauthorized update',
                })
                .expect(401);
        });

        it('should reject non-admin users', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .send({
                    description: 'Candidate update',
                })
                .expect(403);
        });

        it('should allow ADMIN to update a skill', async () => {
            const response = await request(app.getHttpServer())
                .patch(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    description: 'Updated E2E description',
                })
                .expect(200);

            expect(response.body).toMatchObject({
                id: skillId,
                description: 'Updated E2E description',
            });
        });

        it('should reject an invalid update payload', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    category: 'INVALID_CATEGORY',
                })
                .expect(400);
        });

        it('should return 404 when updating a non-existing skill', async () => {
            const nonExistingSkillId =
                '00000000-0000-4000-8000-000000000001';

            await request(app.getHttpServer())
                .patch(`/api/v1/skills/${nonExistingSkillId}`)
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .send({
                    description: 'Should not exist',
                })
                .expect(404);
        });
    });

    describe('DELETE /api/v1/skills/:id', () => {
        it('should reject unauthenticated requests', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/skills/${skillId}`)
                .expect(401);
        });

        it('should reject non-admin users', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(403);
        });

        it('should allow ADMIN to delete a skill', async () => {
            await request(app.getHttpServer())
                .delete(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${adminAccessToken}`,
                )
                .expect(200);
        });

        it('should return 404 after deletion', async () => {
            await request(app.getHttpServer())
                .get(`/api/v1/skills/${skillId}`)
                .set(
                    'Authorization',
                    `Bearer ${candidateAccessToken}`,
                )
                .expect(404);
        });
    });
});