
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { UserRole, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp } from './helpers/create-test-app';

describe('15 - Demo read-only security (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let demoUserId: string;
    let normalUserId: string;
    let demoToken: string;
    let normalToken: string;

    const password = 'SecureDemoPassword123!';
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

        const demoLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: demoUser.email,
                password,
            })
            .expect(201);

        demoToken = demoLogin.body.accessToken;

        expect(demoLogin.body.user.isDemo).toBe(true);

        const normalLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: normalUser.email,
                password,
            })
            .expect(201);

        normalToken = normalLogin.body.accessToken;

        expect(normalLogin.body.user.isDemo).toBe(false);
    });

    afterAll(async () => {
        if (prisma) {
            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: [demoUserId, normalUserId].filter(Boolean),
                    },
                },
            });
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
    });

    describe('Demo account write protection', () => {
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
