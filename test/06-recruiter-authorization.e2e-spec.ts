import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('06 - Recruiter Authorization & Company Isolation (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let recruiterAToken: string;
    let recruiterBToken: string;

    let recruiterAId: string;
    let recruiterBId: string;

    let companyAId: string;
    let companyBId: string;

    let candidateToken: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        /*
         * Recruiter A
         */
        const recruiterAEmail = `e2e-auth-recruiter-a-${Date.now()}@example.com`;
        const recruiterAPassword = 'RecruiterA12345!';

        const recruiterAPasswordHash =
            await argon2.hash(recruiterAPassword);

        const recruiterAUser = await prisma.user.create({
            data: {
                email: recruiterAEmail,
                passwordHash: recruiterAPasswordHash,
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        const recruiterA = await prisma.recruiter.create({
            data: {
                user: {
                    connect: {
                        id: recruiterAUser.id,
                    },
                },
                jobTitle: 'Recruiter A',
            },
        });

        recruiterAId = recruiterA.id;

        /*
         * Recruiter B
         */
        const recruiterBEmail = `e2e-auth-recruiter-b-${Date.now()}@example.com`;
        const recruiterBPassword = 'RecruiterB12345!';

        const recruiterBPasswordHash =
            await argon2.hash(recruiterBPassword);

        const recruiterBUser = await prisma.user.create({
            data: {
                email: recruiterBEmail,
                passwordHash: recruiterBPasswordHash,
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        const recruiterB = await prisma.recruiter.create({
            data: {
                user: {
                    connect: {
                        id: recruiterBUser.id,
                    },
                },
                jobTitle: 'Recruiter B',
            },
        });

        recruiterBId = recruiterB.id;

        /*
         * Login recruiter A
         */
        const recruiterALogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: recruiterAEmail,
                password: recruiterAPassword,
            })
            .expect(201);

        recruiterAToken = recruiterALogin.body.accessToken;

        expect(recruiterAToken).toEqual(expect.any(String));

        /*
         * Login recruiter B
         */
        const recruiterBLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: recruiterBEmail,
                password: recruiterBPassword,
            })
            .expect(201);

        recruiterBToken = recruiterBLogin.body.accessToken;

        expect(recruiterBToken).toEqual(expect.any(String));

        /*
         * Create company A directly in the database.
         */
        const companyA = await prisma.company.create({
            data: {
                name: `Authorization Company A ${Date.now()}`,
                slug: `authorization-company-a-${Date.now()}`,
                description: 'Company owned by recruiter A',
            },
        });

        companyAId = companyA.id;

        /*
         * Create company B directly in the database.
         */
        const companyB = await prisma.company.create({
            data: {
                name: `Authorization Company B ${Date.now()}`,
                slug: `authorization-company-b-${Date.now()}`,
                description: 'Company owned by recruiter B',
            },
        });

        companyBId = companyB.id;

        /*
         * Assign recruiters to their own companies.
         */
        await prisma.recruiter.update({
            where: {
                id: recruiterAId,
            },
            data: {
                companyId: companyAId,
            },
        });

        await prisma.recruiter.update({
            where: {
                id: recruiterBId,
            },
            data: {
                companyId: companyBId,
            },
        });

        /*
         * Candidate account for role-based authorization tests.
         */
        const candidateEmail = `e2e-auth-candidate-${Date.now()}@example.com`;
        const candidatePassword = 'Candidate12345!';

        const candidatePasswordHash =
            await argon2.hash(candidatePassword);

        const candidateUser = await prisma.user.create({
            data: {
                email: candidateEmail,
                passwordHash: candidatePasswordHash,
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
        });

        const candidateLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: candidateEmail,
                password: candidatePassword,
            })
            .expect(201);

        candidateToken = candidateLogin.body.accessToken;

        expect(candidateToken).toEqual(expect.any(String));

        /*
         * Sanity checks.
         */
        expect(recruiterAId).not.toBe(recruiterBId);
        expect(companyAId).not.toBe(companyBId);
    });

    it('should allow recruiter A to retrieve their own company', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterAToken}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyAId,
            description: 'Company owned by recruiter A',
        });
    });

    it('should allow recruiter B to retrieve their own company', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterBToken}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyBId,
            description: 'Company owned by recruiter B',
        });
    });

    it('should allow recruiter A to update their own company', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterAToken}`)
            .send({
                description: 'Updated by recruiter A',
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyAId,
            description: 'Updated by recruiter A',
        });
    });

    it('should allow recruiter B to update their own company', async () => {
        const response = await request(app.getHttpServer())
            .patch('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterBToken}`)
            .send({
                description: 'Updated by recruiter B',
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: companyBId,
            description: 'Updated by recruiter B',
        });
    });

    it('should not allow recruiter A to access recruiter B company through the own-company endpoint', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterAToken}`)
            .expect(200);

        expect(response.body.id).toBe(companyAId);
        expect(response.body.id).not.toBe(companyBId);
    });

    it('should not allow recruiter B to access recruiter A company through the own-company endpoint', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${recruiterBToken}`)
            .expect(200);

        expect(response.body.id).toBe(companyBId);
        expect(response.body.id).not.toBe(companyAId);
    });

    it('should keep recruiter A changes isolated from company B', async () => {
        const companyB = await prisma.company.findUnique({
            where: {
                id: companyBId,
            },
        });

        expect(companyB).not.toBeNull();
        expect(companyB?.description).toBe('Updated by recruiter B');
    });

    it('should keep recruiter B changes isolated from company A', async () => {
        const companyA = await prisma.company.findUnique({
            where: {
                id: companyAId,
            },
        });

        expect(companyA).not.toBeNull();
        expect(companyA?.description).toBe('Updated by recruiter A');
    });

    it('should not allow a candidate to access recruiter company data', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(403);
    });

    it('should not allow a candidate to modify company data', async () => {
        await request(app.getHttpServer())
            .patch('/api/v1/companies/me')
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                description: 'Unauthorized candidate update',
            })
            .expect(403);

        const companyA = await prisma.company.findUnique({
            where: {
                id: companyAId,
            },
        });

        expect(companyA?.description).toBe('Updated by recruiter A');
    });

    it('should reject unauthenticated access to recruiter company', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/companies/me')
            .expect(401);
    });

    it('should reject unauthenticated company updates', async () => {
        await request(app.getHttpServer())
            .patch('/api/v1/companies/me')
            .send({
                description: 'Unauthorized update',
            })
            .expect(401);
    });

    afterAll(async () => {
        /*
         * Delete recruiters first because they reference companies/users.
         */
        await prisma.recruiter.deleteMany({
            where: {
                user: {
                    email: {
                        startsWith: 'e2e-auth-recruiter-',
                    },
                },
            },
        });

        /*
         * Delete companies.
         */
        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [companyAId, companyBId],
                },
            },
        });

        /*
         * Delete the recruiter users.
         */
        await prisma.user.deleteMany({
            where: {
                email: {
                    startsWith: 'e2e-auth-recruiter-',
                },
            },
        });

        /*
         * Delete the candidate created by this test.
         */
        await prisma.user.deleteMany({
            where: {
                email: {
                    startsWith: 'e2e-auth-candidate-',
                },
            },
        });

        await app.close();
    });

});
