import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

interface LoginResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
    };
}

interface JobRequirementResponse {
    skillId: string;
    source: string;
}

interface JobResponse {
    id: string;
    title: string;
    description: string;
    location: string;
    employmentType: string;
    workMode: string;
    salaryMin: number | string | null;
    salaryMax: number | string | null;
    currency: string;
    status: string;
    publishedAt: string | null;
    expiresAt?: string | null;
    companyId: string;
    requirements: JobRequirementResponse[];
}

interface PaginatedJobsResponse {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    items: JobResponse[];
}

interface PublicJobResponse extends JobResponse {
    company: {
        id: string;
        name: string;
    };
}

describe('09 - Job Discovery (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let candidateToken: string;

    let companyId: string;
    let secondCompanyId: string;

    let requiredSkillId: string;
    let preferredSkillId: string;
    let otherSkillId: string;

    let publishedJobId: string;
    let secondPublishedJobId: string;
    let draftJobId: string;
    let expiredJobId: string;
    let pausedJobId: string;
    let closedJobId: string;
    let archivedJobId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        const recruiterEmail = `e2e-discovery-recruiter-${Date.now()}@example.com`;
        const recruiterPassword = 'Recruiter12345!';
        const recruiterPasswordHash = await argon2.hash(recruiterPassword);

        const recruiterUser = await prisma.user.create({
            data: {
                email: recruiterEmail,
                passwordHash: recruiterPasswordHash,
                firstName: 'Test',
                lastName: 'Recruiter',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        const recruiter = await prisma.recruiter.create({
            data: {
                user: {
                    connect: {
                        id: recruiterUser.id,
                    },
                },
                jobTitle: 'Senior Recruiter',
            },
        });

        const candidateEmail = `e2e-discovery-candidate-${Date.now()}@example.com`;
        const candidatePassword = 'Candidate12345!';
        const candidatePasswordHash = await argon2.hash(candidatePassword);

        await prisma.user.create({
            data: {
                email: candidateEmail,
                passwordHash: candidatePasswordHash,
                firstName: 'Test',
                lastName: 'Candidate',
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

        const candidateLoginBody = candidateLogin.body as LoginResponse;
        candidateToken = candidateLoginBody.accessToken;

        const company = await prisma.company.create({
            data: {
                name: `Discovery Company A ${Date.now()}`,
                slug: `discovery-company-a-${Date.now()}`,
                description: 'Primary company for discovery tests',
                location: 'Amsterdam',
            },
        });

        companyId = company.id;

        const secondCompany = await prisma.company.create({
            data: {
                name: `Discovery Company B ${Date.now()}`,
                slug: `discovery-company-b-${Date.now()}`,
                description: 'Secondary company for discovery tests',
                location: 'Rotterdam',
            },
        });

        secondCompanyId = secondCompany.id;

        await prisma.recruiter.update({
            where: {
                id: recruiter.id,
            },
            data: {
                companyId,
            },
        });

        const requiredSkill = await prisma.skill.create({
            data: {
                name: `Discovery TypeScript ${Date.now()}`,
                slug: `discovery-typescript-${Date.now()}`,
                category: 'BACKEND',
                description: 'Required discovery skill',
            },
        });

        requiredSkillId = requiredSkill.id;

        const preferredSkill = await prisma.skill.create({
            data: {
                name: `Discovery PostgreSQL ${Date.now()}`,
                slug: `discovery-postgresql-${Date.now()}`,
                category: 'DEVOPS',
                description: 'Preferred discovery skill',
            },
        });

        preferredSkillId = preferredSkill.id;

        const otherSkill = await prisma.skill.create({
            data: {
                name: `Discovery Other Skill ${Date.now()}`,
                slug: `discovery-other-skill-${Date.now()}`,
                category: 'DATABASE',
                description: 'Other discovery skill',
            },
        });

        otherSkillId = otherSkill.id;

        const publishedJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Senior Backend Developer',
                description: 'Build scalable TypeScript backend services.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 5000,
                salaryMax: 7000,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt: new Date(),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
                requirements: {
                    create: [
                        {
                            skillId: requiredSkillId,
                            minimumLevel: 2,
                            required: true,
                        },
                        {
                            skillId: preferredSkillId,
                            minimumLevel: 1,
                            required: false,
                        },
                    ],
                },
            },
            include: {
                requirements: true,
            },
        });

        publishedJobId = publishedJob.id;

        const secondPublishedJob = await prisma.job.create({
            data: {
                companyId: secondCompanyId,
                createdByRecruiterId: recruiter.id,
                title: 'Frontend Developer',
                description: 'Develop modern frontend applications.',
                location: 'Rotterdam',
                employmentType: 'PART_TIME',
                workMode: 'HYBRID',
                salaryMin: 3500,
                salaryMax: 5000,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
                requirements: {
                    create: [
                        {
                            skillId: otherSkillId,
                            minimumLevel: 1,
                            required: true,
                        },
                    ],
                },
            },
        });

        secondPublishedJobId = secondPublishedJob.id;

        const draftJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Draft Backend Developer',
                description: 'This draft must not be discoverable.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 4000,
                salaryMax: 6000,
                currency: 'EUR',
                status: 'DRAFT',
            },
        });

        draftJobId = draftJob.id;

        const expiredJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Expired Backend Developer',
                description: 'This published job has expired.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 6000,
                salaryMax: 8000,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
        });

        expiredJobId = expiredJob.id;

        const pausedJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Paused Backend Developer',
                description: 'This paused job must not be discoverable.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 6000,
                salaryMax: 8000,
                currency: 'EUR',
                status: 'PAUSED',
                publishedAt: new Date(),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
            },
        });

        pausedJobId = pausedJob.id;

        const closedJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Closed Backend Developer',
                description: 'This closed job must not be discoverable.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 6000,
                salaryMax: 8000,
                currency: 'EUR',
                status: 'CLOSED',
                publishedAt: new Date(),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
            },
        });

        closedJobId = closedJob.id;

        const archivedJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Archived Backend Developer',
                description: 'This archived job must not be discoverable.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 6000,
                salaryMax: 8000,
                currency: 'EUR',
                status: 'ARCHIVED',
                publishedAt: new Date(),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
            },
        });

        archivedJobId = archivedJob.id;
    });

    afterAll(async () => {
        const jobIds = [
            publishedJobId,
            secondPublishedJobId,
            draftJobId,
            expiredJobId,
            pausedJobId,
            closedJobId,
            archivedJobId,
        ].filter(Boolean);

        await prisma.jobRequirement.deleteMany({
            where: {
                jobId: {
                    in: jobIds,
                },
            },
        });

        await prisma.job.deleteMany({
            where: {
                id: {
                    in: jobIds,
                },
            },
        });

        await prisma.recruiter.deleteMany({
            where: {
                companyId: {
                    in: [companyId, secondCompanyId].filter(Boolean),
                },
            },
        });

        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [companyId, secondCompanyId].filter(Boolean),
                },
            },
        });

        await prisma.skill.deleteMany({
            where: {
                id: {
                    in: [
                        requiredSkillId,
                        preferredSkillId,
                        otherSkillId,
                    ].filter(Boolean),
                },
            },
        });

        await app.close();
    });

    it('01 - should reject unauthenticated discovery requests', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .expect(401);
    });

    it('02 - should allow an authenticated candidate to discover jobs', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body).toHaveProperty('items');
        expect(body).toHaveProperty('total');
        expect(body).toHaveProperty('page');
        expect(body).toHaveProperty('limit');
        expect(body).toHaveProperty('totalPages');
    });

    it('03 - should return only currently published jobs', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;
        const ids = body.items.map((job) => job.id);

        expect(ids).toContain(publishedJobId);
        expect(ids).toContain(secondPublishedJobId);

        expect(ids).not.toContain(draftJobId);
        expect(ids).not.toContain(pausedJobId);
        expect(ids).not.toContain(closedJobId);
        expect(ids).not.toContain(archivedJobId);
    });

    it('04 - should exclude expired published jobs', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;
        const ids = body.items.map((job) => job.id);

        expect(ids).not.toContain(expiredJobId);
    });

    it('05 - should return candidate-facing public job details', async () => {
        const response = await request(app.getHttpServer())
            .get(`/api/v1/jobs/${publishedJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PublicJobResponse;

        expect(body).toMatchObject({
            id: publishedJobId,
            title: 'Senior Backend Developer',
            description: 'Build scalable TypeScript backend services.',
            location: 'Amsterdam',
            employmentType: 'FULL_TIME',
            workMode: 'REMOTE',
            currency: 'EUR',
            status: 'PUBLISHED',
        });

        expect(Number(body.salaryMin)).toBe(5000);
        expect(Number(body.salaryMax)).toBe(7000);
        expect(body.publishedAt).not.toBeNull();
        expect(body.expiresAt).not.toBeNull();

        expect(body).toHaveProperty('company');
        expect(body.company.id).toBe(companyId);

        expect(body).toHaveProperty('requirements');
        expect(body.requirements).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    skillId: requiredSkillId,
                }),
                expect.objectContaining({
                    skillId: preferredSkillId,
                }),
            ]),
        );
    });

    it('06 - should not expose a draft job through job detail', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/jobs/${draftJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    it('07 - should not expose an expired job through job detail', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/jobs/${expiredJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    it('08 - should not expose a paused job through job detail', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/jobs/${pausedJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    it('09 - should not expose a closed job through job detail', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/jobs/${closedJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    it('10 - should not expose an archived job through job detail', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/jobs/${archivedJobId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(404);
    });

    it('11 - should filter jobs by title search', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                q: 'Senior Backend',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('12 - should filter jobs by description search', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                q: 'TypeScript backend services',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('13 - should filter jobs by company name search', async () => {
        const company = await prisma.company.findUnique({
            where: {
                id: companyId,
            },
        });

        expect(company).not.toBeNull();

        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                q: company?.name,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('14 - should filter jobs by location', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                location: 'Amsterdam',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(
            body.items.every((job) =>
                job.location.toLowerCase().includes('amsterdam'),
            ),
        ).toBe(true);

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
    });

    it('15 - should filter jobs by work mode', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                workMode: 'REMOTE',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.every((job) => job.workMode === 'REMOTE')).toBe(true);
    });

    it('16 - should filter jobs by multiple work modes', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                workModes: 'REMOTE,HYBRID',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.length).toBeGreaterThan(0);

        expect(
            body.items.every(
                (job) => job.workMode === 'REMOTE' || job.workMode === 'HYBRID',
            ),
        ).toBe(true);

        expect(body.items.map((job) => job.id)).toEqual(
            expect.arrayContaining([
                publishedJobId,
                secondPublishedJobId,
            ]),
        );
    });

    it('17 - should support any combination of work modes', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                workModes: 'REMOTE,HYBRID,ONSITE,FLEXIBLE',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.length).toBeGreaterThan(0);

        expect(
            body.items.every((job) =>
                ['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE'].includes(
                    job.workMode,
                ),
            ),
        ).toBe(true);

        expect(body.items.map((job) => job.id)).toEqual(
            expect.arrayContaining([
                publishedJobId,
                secondPublishedJobId,
            ]),
        );
    });

    it('18 - should reject an invalid work mode in workModes', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                workModes: 'REMOTE,INVALID',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('19 - should filter jobs by employment type', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                employmentType: 'PART_TIME',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(
            body.items.every((job) => job.employmentType === 'PART_TIME'),
        ).toBe(true);
    });

    it('20 - should filter by minimum salary', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                salaryMin: 6000,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('21 - should filter by maximum salary', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                salaryMax: 5000,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(true);
        expect(body.items.some((job) => job.id === publishedJobId)).toBe(
            false,
        );
    });

    it('22 - should filter by salary range', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                salaryMin: 3500,
                salaryMax: 5000,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(true);
        expect(body.items.some((job) => job.id === publishedJobId)).toBe(
            false,
        );
    });

    it('23 - should filter jobs by skill ID', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                skillIds: requiredSkillId,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('24 - should filter jobs by multiple skill IDs', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                skillIds: `${requiredSkillId},${preferredSkillId}`,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.some((job) => job.id === publishedJobId)).toBe(true);
        expect(
            body.items.some((job) => job.id === secondPublishedJobId),
        ).toBe(false);
    });

    it('25 - should sort jobs by newest', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                sort: 'newest',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.length).toBeGreaterThanOrEqual(2);
        expect(body.items[0].id).toBe(publishedJobId);
    });

    it('26 - should sort jobs by salary', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                sort: 'salary',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.items.length).toBeGreaterThanOrEqual(2);
        expect(Number(body.items[0].salaryMax)).toBeGreaterThanOrEqual(
            Number(body.items[1].salaryMax),
        );
    });

    it('27 - should sort jobs by title', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                sort: 'title',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);
    });


    it('28 - should paginate results', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                page: 1,
                limit: 1,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.page).toBe(1);
        expect(body.limit).toBe(1);
        expect(body.items).toHaveLength(1);
        expect(body.total).toBeGreaterThanOrEqual(2);
        expect(body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('29 - should return the second page', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                page: 2,
                limit: 1,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200);

        const body = response.body as PaginatedJobsResponse;

        expect(body.page).toBe(2);
        expect(body.limit).toBe(1);
        expect(body.items).toHaveLength(1);
    });

    it('30 - should reject an invalid work mode', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                workMode: 'INVALID',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('31 - should reject an invalid employment type', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                employmentType: 'INVALID',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('32 - should reject an invalid skill UUID', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                skillIds: 'not-a-uuid',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('33 - should reject an invalid sort value', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                sort: 'salaryAsc',
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('34 - should reject an invalid salary range', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                salaryMin: 7000,
                salaryMax: 5000,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('35 - should reject a negative salary', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                salaryMin: -1,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('36 - should reject invalid pagination parameters', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                page: 0,
                limit: 101,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });

    it('37 - should reject a non-integer page', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/jobs')
            .query({
                page: 1.5,
            })
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400);
    });
});
