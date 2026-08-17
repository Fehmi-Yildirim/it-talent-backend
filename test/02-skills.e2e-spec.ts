import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';

describe('02 - Skills (e2e)', () => {

    let skillSlug: string;
    let app: INestApplication;
    let accessToken: string;
    let skillId: string;

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

        expect(accessToken).toEqual(expect.any(String));
    });

    it('should list skills', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/skills')
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create a skill', async () => {
        const uniqueSlug = `e2e-typescript-${Date.now()}`;
        skillSlug = uniqueSlug;
        const response = await request(app.getHttpServer())
            .post('/api/v1/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'E2E TypeScript',
                slug: uniqueSlug,
                category: 'FULLSTACK',
                description: 'Skill created by E2E test',
            })
            .expect(201);

        expect(response.body).toMatchObject({
            name: 'E2E TypeScript',
            slug: uniqueSlug,
            category: 'FULLSTACK',
            description: 'Skill created by E2E test',
        });

        expect(response.body.id).toEqual(expect.any(String));

        skillId = response.body.id;
    });

    it('should get the created skill', async () => {
        const response = await request(app.getHttpServer())
            .get(`/api/v1/skills/${skillId}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: skillId,
            name: 'E2E TypeScript',
            category: 'FULLSTACK',
        });
    });

    it('should find the skill by search', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/skills?search=typescript')
            .expect(200);

        expect(
            response.body.some((skill: { id: string }) => skill.id === skillId),
        ).toBe(true);
    });

    it('should update the skill', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/v1/skills/${skillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                description: 'Updated E2E description',
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: skillId,
            description: 'Updated E2E description',
        });
    });

    it('should reject a duplicate slug', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'Another TypeScript',
                slug: skillSlug,
                category: 'FULLSTACK',
            })
            .expect(409);

        expect(response.body.message).toBe(
            'Skill with this slug already exists',
        );
    });
    it('should delete the skill', async () => {
        await request(app.getHttpServer())
            .delete(`/api/v1/skills/${skillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
    });

    it('should return 404 after deletion', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/skills/${skillId}`)
            .expect(404);
    });

    afterAll(async () => {
        await app.close();
    });
});


