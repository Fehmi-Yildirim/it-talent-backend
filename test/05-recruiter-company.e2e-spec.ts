import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('05 - Recruiter & Company (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let recruiterToken: string;
    let userId: string;
    let recruiterId: string;
    let companyId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        const email = `e2e-recruiter-${Date.now()}@example.com`;
        const password = 'Recruiter12345!';

        const passwordHash = await argon2.hash(password);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        userId = user.id;

        const recruiter = await prisma.recruiter.create({
            data: {
                user: {
                    connect: {
                        id: user.id,
                    },
                },
                jobTitle: 'Senior Recruiter',
            },
        });

        recruiterId = recruiter.id;

        const loginResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email,
                password,
            })
            .expect(201);

        recruiterToken = loginResponse.body.accessToken;

        expect(recruiterToken).toEqual(expect.any(String));
    });

    it('should retrieve the recruiter profile', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/recruiters/me')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: recruiterId,
            jobTitle: 'Senior Recruiter',
        });
    });

    it('should update the recruiter profile', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/v1/recruiters/me')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                jobTitle: 'Lead Recruiter',
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: recruiterId,
            jobTitle: 'Lead Recruiter',
        });
    });

    it('should return 404 when recruiter has no company', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(404);
    });

    it('should allow the recruiter to create a company', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/companies')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                name: `E2E Company ${Date.now()}`,
                description: 'Company created during E2E testing',
            })
            .expect(201);

        expect(response.body).toMatchObject({
            description: 'Company created during E2E testing',
        });

        expect(response.body.id).toEqual(expect.any(String));
        expect(response.body.slug).toEqual(expect.any(String));

        companyId = response.body.id;
    });

    it('should assign the recruiter to the created company', async () => {
        const recruiter = await prisma.recruiter.findUnique({
            where: {
                id: recruiterId,
            },
        });

        expect(recruiter).not.toBeNull();
        expect(recruiter?.companyId).toBe(companyId);
    });

    it('should retrieve the recruiter company', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyId,
            description: 'Company created during E2E testing',
        });
    });

    it('should update the recruiter company', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                description: 'Updated E2E company description',
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyId,
            description: 'Updated E2E company description',
        });
    });

    afterAll(async () => {
        await prisma.recruiter.deleteMany({
            where: {
                id: recruiterId,
            },
        });

        await prisma.company.deleteMany({
            where: {
                id: companyId,
            },
        });

        await prisma.user.delete({
            where: {
                id: userId,
            },
        });

        await app.close();
    });
});