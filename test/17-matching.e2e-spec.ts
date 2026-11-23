/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('17 - Matching (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let candidateToken: string;
    let recruiterToken: string;

    let candidateUserId: string;
    let recruiterUserId: string;
    let candidateId: string;
    let recruiterId: string;
    let companyId: string;
    let skillId: string;
    let jobId: string;

    let candidateSkillId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        const timestamp = Date.now();
        const password = 'MatchingE2E12345!';
        const passwordHash = await argon2.hash(password);

        // Create candidate user and profile.
        const candidateUser = await prisma.user.create({
            data: {
                email: `matching-candidate-${timestamp}@example.com`,
                passwordHash,
                firstName: 'Matching',
                lastName: 'Candidate',
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
        });

        candidateUserId = candidateUser.id;

        const candidate = await prisma.candidate.create({
            data: {
                userId: candidateUserId,
            },
        });

        candidateId = candidate.id;

        // Create recruiter user and company.
        const recruiterUser = await prisma.user.create({
            data: {
                email: `matching-recruiter-${timestamp}@example.com`,
                passwordHash,
                firstName: 'Matching',
                lastName: 'Recruiter',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        recruiterUserId = recruiterUser.id;

        const company = await prisma.company.create({
            data: {
                name: `Matching E2E Company ${timestamp}`,
                slug: `matching-e2e-company-${timestamp}`,
                description: 'Company for matching E2E tests',
            },
        });

        companyId = company.id;

        const recruiter = await prisma.recruiter.create({
            data: {
                userId: recruiterUserId,
                companyId,
                jobTitle: 'Recruiter',
            },
        });

        recruiterId = recruiter.id;

        // Create a skill used by both candidate and job.
        const skill = await prisma.skill.create({
            data: {
                name: `Matching TypeScript ${timestamp}`,
                slug: `matching-typescript-${timestamp}`,
                category: 'BACKEND',
                description: 'Skill for matching E2E tests',
            },
        });

        skillId = skill.id;

        // Login as candidate.
        const candidateLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: candidateUser.email,
                password,
            })
            .expect(201);

        candidateToken = candidateLogin.body.accessToken;

        // Login as recruiter.
        const recruiterLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: recruiterUser.email,
                password,
            })
            .expect(201);

        recruiterToken = recruiterLogin.body.accessToken;

        // Create a job with one required skill.
        const jobResponse = await request(app.getHttpServer())
            .post('/api/v1/jobs')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                title: 'Matching Backend Developer',
                description: 'Backend developer for matching E2E tests.',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                requiredSkillIds: [skillId],
            })
            .expect(201);

        jobId = jobResponse.body.id;

        jobId = jobResponse.body.id;

        await prisma.jobRequirement.updateMany({
            where: {
                jobId,
                skillId,
            },
            data: {
                minimumLevel: 4,
            },
        });
    });

    describe('automatic matching', () => {
        it('should create matches when a recruiter publishes a job', async () => {
            await request(app.getHttpServer())
                .post(`/api/v1/jobs/${jobId}/publish`)
                .set('Authorization', `Bearer ${recruiterToken}`)
                .expect(201);

            const job = await prisma.job.findUnique({
                where: { id: jobId },
            });

            expect(job?.status).toBe('PUBLISHED');
        });

        it('should calculate a match after a candidate adds a required skill', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/candidates/me/skills')
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({
                    skillId,
                    proficiencyLevel: 2,
                    yearsOfExperience: 2,
                })
                .expect(201);

            candidateSkillId = response.body.id;

            const match = await prisma.match.findUnique({
                where: {
                    candidateId_jobId: {
                        candidateId,
                        jobId,
                    },
                },
            });

            expect(match).not.toBeNull();
            expect(Number(match?.overallScore)).toBe(50);
            expect(Number(match?.skillScore)).toBe(50);
        });

        it('should return matches for the authenticated candidate', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/matches/me')
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(200);

            expect(response.body.meta.total).toBeGreaterThanOrEqual(1);

            const match = response.body.data.find(
                (item: { jobId: string }) => item.jobId === jobId,
            );

            expect(match).toBeDefined();
            expect(Number(match.overallScore)).toBe(50);
            expect(match.explanation.algorithm).toBe('weighted-skill-v1');
        });

        it('should return matching candidates for the recruiter job', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/matches/jobs/${jobId}/candidates`)
                .set('Authorization', `Bearer ${recruiterToken}`)
                .expect(200);

            expect(response.body.meta.total).toBeGreaterThanOrEqual(1);

            const match = response.body.data.find(
                (item: { candidateId: string }) =>
                    item.candidateId === candidateId,
            );

            expect(match).toBeDefined();
            expect(Number(match.overallScore)).toBe(50);
        });

        it('should recalculate the match after candidate skill proficiency changes', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/candidates/me/skills/${candidateSkillId}`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .send({
                    proficiencyLevel: 4,
                })
                .expect(200);

            const match = await prisma.match.findUnique({
                where: {
                    candidateId_jobId: {
                        candidateId,
                        jobId,
                    },
                },
            });

            expect(match).not.toBeNull();
            expect(Number(match?.overallScore)).toBe(100);
            expect(Number(match?.skillScore)).toBe(100);
        });

        it('should return the updated score through the candidate matches endpoint', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/matches/me')
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(200);

            const match = response.body.data.find(
                (item: { jobId: string }) => item.jobId === jobId,
            );

            expect(match).toBeDefined();
            expect(Number(match.overallScore)).toBe(100);
        });

        it('should return the updated score through the recruiter matches endpoint', async () => {
            const response = await request(app.getHttpServer())
                .get(`/api/v1/matches/jobs/${jobId}/candidates`)
                .set('Authorization', `Bearer ${recruiterToken}`)
                .expect(200);

            const match = response.body.data.find(
                (item: { candidateId: string }) =>
                    item.candidateId === candidateId,
            );

            expect(match).toBeDefined();
            expect(Number(match.overallScore)).toBe(100);
        });
    });

    describe('authorization', () => {
        it('should reject unauthenticated access to candidate matches', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/matches/me')
                .expect(401);
        });

        it('should reject unauthenticated access to recruiter matches', async () => {
            await request(app.getHttpServer())
                .get(`/api/v1/matches/jobs/${jobId}/candidates`)
                .expect(401);
        });

        it('should reject a candidate accessing recruiter match results', async () => {
            await request(app.getHttpServer())
                .get(`/api/v1/matches/jobs/${jobId}/candidates`)
                .set('Authorization', `Bearer ${candidateToken}`)
                .expect(403);
        });

        it('should reject a recruiter accessing candidate match results', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/matches/me')
                .set('Authorization', `Bearer ${recruiterToken}`)
                .expect(403);
        });
    });

    afterAll(async () => {
        if (app) {
            if (candidateId && jobId) {
                await prisma.match.deleteMany({
                    where: {
                        candidateId,
                        jobId,
                    },
                });
            }

            if (candidateId) {
                await prisma.match.deleteMany({
                    where: { candidateId },
                });

                await prisma.candidateSkill.deleteMany({
                    where: { candidateId },
                });
            }

            if (candidateId) {
                await prisma.candidateSkill.deleteMany({
                    where: { candidateId },
                });
            }

            if (jobId) {
                await prisma.match.deleteMany({
                    where: { jobId },
                });

                await prisma.jobRequirement.deleteMany({
                    where: { jobId },
                });

                await prisma.job.deleteMany({
                    where: { id: jobId },
                });
            }

            if (recruiterId) {
                await prisma.recruiter.delete({
                    where: { id: recruiterId },
                });
            }

            if (candidateId) {
                await prisma.candidate.delete({
                    where: { id: candidateId },
                });
            }

            if (companyId) {
                await prisma.company.delete({
                    where: { id: companyId },
                });
            }

            if (skillId) {
                await prisma.skill.delete({
                    where: { id: skillId },
                });
            }

            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: [candidateUserId, recruiterUserId].filter(Boolean),
                    },
                },
            });

            await app.close();
        }
    });
});
