
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { UserRole, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './helpers/create-test-app';

interface LoginResponse {
    accessToken: string;
    user: {
        isDemo: boolean;
        role: UserRole;
    };
}

describe('15 - Demo read-only security (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let demoUserId: string;
    let normalUserId: string;
    let demoRecruiterId: string;
    let demoRecruiterProfileId: string;
    let demoCompanyId: string;

    let demoToken: string;
    let normalToken: string;
    let demoRecruiterToken: string;

    const password = 'SecureDemoPassword123!';
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const testJobId = '22222222-2222-4222-8222-222222222241';
    const testApplicationId = '22222222-2222-4222-8222-222222222242';

    beforeAll(async () => {
        app = await createTestApp({ disableRateLimit: true });
        prisma = app.get(PrismaService);

        const passwordHash = await argon2.hash(password);

        const demoUser = await prisma.user.create({
            data: {
                email: `demo-security-${uniqueSuffix}@example.com`,
                passwordHash,
                firstName: 'Demo',
                lastName: 'Candidate',
                role: UserRole.CANDIDATE,
                status: UserStatus.ACTIVE,
                isDemo: true,
            },
        });

        demoUserId = demoUser.id;

        const normalUser = await prisma.user.create({
            data: {
                email: `normal-security-${uniqueSuffix}@example.com`,
                passwordHash,
                firstName: 'Normal',
                lastName: 'Candidate',
                role: UserRole.CANDIDATE,
                status: UserStatus.ACTIVE,
                isDemo: false,
            },
        });

        normalUserId = normalUser.id;

        const demoRecruiter = await prisma.user.create({
            data: {
                email: `demo-recruiter-${uniqueSuffix}@example.com`,
                passwordHash,
                firstName: 'Demo',
                lastName: 'Recruiter',
                role: UserRole.RECRUITER,
                status: UserStatus.ACTIVE,
                isDemo: true,
            },
        });

        demoRecruiterId = demoRecruiter.id;

        const demoCompany = await prisma.company.create({
            data: {
                name: `Demo Security ${uniqueSuffix}`,
                slug: `demo-security-${uniqueSuffix}`,
            },
        });
        demoCompanyId = demoCompany.id;

        const demoRecruiterProfile = await prisma.recruiter.create({
            data: {
                userId: demoRecruiter.id,
                companyId: demoCompany.id,
            },
        });
        demoRecruiterProfileId = demoRecruiterProfile.id;

        const demoLogin = (await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: demoUser.email,
                password,
            })
            .expect(201)) as unknown as { body: LoginResponse };

        demoToken = demoLogin.body.accessToken;

        expect(demoLogin.body.user.isDemo).toBe(true);

        const normalLogin = (await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: normalUser.email,
                password,
            })
            .expect(201)) as unknown as { body: LoginResponse };

        normalToken = normalLogin.body.accessToken;

        expect(normalLogin.body.user.isDemo).toBe(false);

        const recruiterLogin = (await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: demoRecruiter.email,
                password,
            })
            .expect(201)) as unknown as { body: LoginResponse };

        demoRecruiterToken = recruiterLogin.body.accessToken;

        expect(recruiterLogin.body.user.isDemo).toBe(true);
        expect(recruiterLogin.body.user.role).toBe(UserRole.RECRUITER);
    });

    afterAll(async () => {
        if (prisma) {
            if (demoRecruiterProfileId) {
                await prisma.recruiter.deleteMany({
                    where: { id: demoRecruiterProfileId },
                });
            }

            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: [
                            demoUserId,
                            normalUserId,
                            demoRecruiterId,
                        ].filter(Boolean),
                    },
                },
            });

            if (demoCompanyId) {
                await prisma.company.deleteMany({
                    where: { id: demoCompanyId },
                });
            }
        }

        if (app) {
            await app.close();
        }
    });

    describe('Demo account read access', () => {
        it('allows a demo account to access its own profile', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/users/me')
                .set('Authorization', `Bearer ${demoToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: demoUserId,
                firstName: 'Demo',
                lastName: 'Candidate',
            });
        });

        it('allows a demo candidate to access candidate read routes', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/candidates/me')
                .set('Authorization', `Bearer ${demoToken}`)
                .expect(404);
        });

        it('allows a demo recruiter to access job read routes', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/jobs')
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .expect(200);
        });
    });

    describe('Demo account write protection - users', () => {
        it('rejects PATCH /users/me for a demo account', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${demoToken}`)
                .send({
                    firstName: 'Changed',
                    lastName: 'Name',
                })
                .expect(403);
        });

        it('rejects PATCH /users/:id for a demo account', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/users/${demoUserId}`)
                .set('Authorization', `Bearer ${demoToken}`)
                .send({
                    firstName: 'Changed',
                    lastName: 'Name',
                })
                .expect(403);
        });
    });

    describe('Demo account write protection - candidates', () => {
        it('rejects POST /candidates for a demo candidate', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${demoToken}`)
                .send({})
                .expect(403);
        });

        it('rejects PATCH /candidates/me for a demo candidate', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/candidates/me')
                .set('Authorization', `Bearer ${demoToken}`)
                .send({})
                .expect(403);
        });

        it('rejects CV deletion for a demo candidate', async () => {
            await request(app.getHttpServer())
                .delete('/api/v1/candidates/me/cv')
                .set('Authorization', `Bearer ${demoToken}`)
                .expect(403);
        });
    });

    describe('Demo account write protection - jobs', () => {
        it('rejects POST /jobs for a demo recruiter', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .send({})
                .expect(403);
        });

        it('rejects PATCH /jobs/:jobId for a demo recruiter', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/jobs/${testJobId}`)
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .send({})
                .expect(403);
        });

        it('rejects publishing a job for a demo recruiter', async () => {
            await request(app.getHttpServer())
                .post(`/api/v1/jobs/${testJobId}/publish`)
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .expect(403);
        });

        it('rejects creating job requirements for a demo recruiter', async () => {
            await request(app.getHttpServer())
                .post(`/api/v1/jobs/${testJobId}/requirements`)
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .send({})
                .expect(403);
        });
    });

    describe('Demo account write protection - applications', () => {
        it('rejects creating an application for a demo candidate', async () => {
            await request(app.getHttpServer())
                .post(`/api/v1/jobs/${testJobId}/applications`)
                .set('Authorization', `Bearer ${demoToken}`)
                .send({})
                .expect(403);
        });

        it('rejects withdrawing an application for a demo candidate', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/applications/${testApplicationId}/withdraw`)
                .set('Authorization', `Bearer ${demoToken}`)
                .expect(403);
        });

        it('rejects changing application status for a demo recruiter', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/recruiter/applications/${testApplicationId}/status`)
                .set('Authorization', `Bearer ${demoRecruiterToken}`)
                .send({})
                .expect(403);
        });
    });

    describe('Demo account data integrity', () => {
        it('does not change demo account data after rejected requests', async () => {
            const user = await prisma.user.findUniqueOrThrow({
                where: { id: demoUserId },
                select: {
                    firstName: true,
                    lastName: true,
                    isDemo: true,
                },
            });

            expect(user).toEqual({
                firstName: 'Demo',
                lastName: 'Candidate',
                isDemo: true,
            });
        });

        it('does not change demo recruiter data after rejected requests', async () => {
            const recruiter = await prisma.user.findUniqueOrThrow({
                where: { id: demoRecruiterId },
                select: {
                    firstName: true,
                    lastName: true,
                    isDemo: true,
                },
            });

            expect(recruiter).toEqual({
                firstName: 'Demo',
                lastName: 'Recruiter',
                isDemo: true,
            });
        });
    });

    describe('Normal account write access', () => {
        it('allows a normal account to update its own profile', async () => {
            await request(app.getHttpServer())
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${normalToken}`)
                .send({
                    firstName: 'Updated',
                    lastName: 'Candidate',
                })
                .expect(200);

            const user = await prisma.user.findUniqueOrThrow({
                where: { id: normalUserId },
                select: {
                    firstName: true,
                    lastName: true,
                    isDemo: true,
                },
            });

            expect(user).toEqual({
                firstName: 'Updated',
                lastName: 'Candidate',
                isDemo: false,
            });
        });
    });
});
