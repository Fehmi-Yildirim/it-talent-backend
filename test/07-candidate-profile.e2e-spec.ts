import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('07 - Authenticated Candidate Profile (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let candidateToken: string;
    let recruiterToken: string;

    let candidateUserId: string;
    let candidateProfileId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        const timestamp = Date.now();

        /*
         * Candidate
         */
        const candidateEmail =
            `e2e-candidate-profile-${timestamp}@example.com`;
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

        candidateUserId = candidateUser.id;

        const candidate = await prisma.candidate.create({
            data: {
                userId: candidateUser.id,
                headline: 'Senior TypeScript Developer',
                summary: 'Experienced backend and frontend developer.',
                location: 'Amsterdam',
                salaryMin: 5000,
                salaryMax: 7000,
                currency: 'EUR',
                remotePreference: 'HYBRID',
            },
        });

        candidateProfileId = candidate.id;

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
         * Recruiter
         */
        const recruiterEmail =
            `e2e-candidate-profile-recruiter-${timestamp}@example.com`;
        const recruiterPassword = 'Recruiter12345!';

        const recruiterPasswordHash =
            await argon2.hash(recruiterPassword);

        await prisma.user.create({
            data: {
                email: recruiterEmail,
                passwordHash: recruiterPasswordHash,
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        const recruiterLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: recruiterEmail,
                password: recruiterPassword,
            })
            .expect(201);

        recruiterToken = recruiterLogin.body.accessToken;

        expect(recruiterToken).toEqual(expect.any(String));
    });

    it('should allow an authenticated candidate to retrieve their own profile', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/users/me/candidate')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        expect(response.body).toMatchObject({
            id: candidateProfileId,
            userId: candidateUserId,
            headline: 'Senior TypeScript Developer',
            summary: 'Experienced backend and frontend developer.',
            location: 'Amsterdam',
            salaryMin: '5000',
            salaryMax: '7000',
            currency: 'EUR',
            remotePreference: 'HYBRID',
        });
    });

    it('should reject unauthenticated access', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/users/me/candidate')
            .expect(401);
    });

    it('should reject recruiter access', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/users/me/candidate')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(403);
    });

    it('should return 404 when the candidate profile does not exist', async () => {
        await prisma.candidate.delete({
            where: {
                id: candidateProfileId,
            },
        });

        await request(app.getHttpServer())
            .get('/api/v1/users/me/candidate')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    afterAll(async () => {
        /*
         * Candidate profile is already deleted by the
         * "profile does not exist" test.
         */
        await prisma.user.deleteMany({
            where: {
                email: {
                    startsWith: 'e2e-candidate-profile-',
                },
            },
        });

        await prisma.user.deleteMany({
            where: {
                email: {
                    startsWith: 'e2e-candidate-profile-recruiter-',
                },
            },
        });

        await app.close();
    });
});