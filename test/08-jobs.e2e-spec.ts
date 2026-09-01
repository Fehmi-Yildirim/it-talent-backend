import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('08 - Jobs (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    let recruiterToken: string;
    let recruiterId: string;
    let recruiterUserId: string;

    let secondRecruiterToken: string;
    let secondRecruiterId: string;
    let secondRecruiterUserId: string;

    let candidateToken: string;
    let candidateUserId: string;

    let companyId: string;
    let secondCompanyId: string;

    let skillRequiredId: string;
    let skillPreferredId: string;
    let skillOtherId: string;

    let jobId: string;
    let secondJobId: string;
    let requirementId: string;

    beforeAll(async () => {
        app = await createTestApp();
        prisma = app.get(PrismaService);

        /*
         * ============================================================
         * Recruiter A
         * ============================================================
         */

        const recruiterEmail =
            `e2e-jobs-recruiter-a-${Date.now()}@example.com`;
        const recruiterPassword = 'Recruiter12345!';

        const recruiterPasswordHash =
            await argon2.hash(recruiterPassword);

        const recruiterUser = await prisma.user.create({
            data: {
                email: recruiterEmail,
                passwordHash: recruiterPasswordHash,
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        });

        recruiterUserId = recruiterUser.id;

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

        recruiterId = recruiter.id;

        const recruiterLogin =
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: recruiterEmail,
                    password: recruiterPassword,
                })
                .expect(201);

        recruiterToken = recruiterLogin.body.accessToken;

        expect(recruiterToken).toEqual(expect.any(String));

        /*
         * ============================================================
         * Recruiter B
         * ============================================================
         */

        const secondRecruiterEmail =
            `e2e-jobs-recruiter-b-${Date.now()}@example.com`;
        const secondRecruiterPassword = 'Recruiter12345!';

        const secondRecruiterPasswordHash =
            await argon2.hash(secondRecruiterPassword);

        const secondRecruiterUser =
            await prisma.user.create({
                data: {
                    email: secondRecruiterEmail,
                    passwordHash: secondRecruiterPasswordHash,
                    role: 'RECRUITER',
                    status: 'ACTIVE',
                },
            });

        secondRecruiterUserId = secondRecruiterUser.id;

        const secondRecruiter =
            await prisma.recruiter.create({
                data: {
                    user: {
                        connect: {
                            id: secondRecruiterUser.id,
                        },
                    },
                    jobTitle: 'Recruiter B',
                },
            });

        secondRecruiterId = secondRecruiter.id;

        const secondRecruiterLogin =
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: secondRecruiterEmail,
                    password: secondRecruiterPassword,
                })
                .expect(201);

        secondRecruiterToken =
            secondRecruiterLogin.body.accessToken;

        expect(secondRecruiterToken).toEqual(
            expect.any(String),
        );

        /*
         * ============================================================
         * Candidate
         * ============================================================
         */

        const candidateEmail =
            `e2e-jobs-candidate-${Date.now()}@example.com`;
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

        const candidateLogin =
            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({
                    email: candidateEmail,
                    password: candidatePassword,
                })
                .expect(201);

        candidateToken = candidateLogin.body.accessToken;

        expect(candidateToken).toEqual(expect.any(String));

        /*
         * ============================================================
         * Companies
         * ============================================================
         */

        const company = await prisma.company.create({
            data: {
                name: `E2E Jobs Company A ${Date.now()}`,
                slug: `e2e-jobs-company-a-${Date.now()}`,
                description: 'Company A for jobs E2E tests',
            },
        });

        companyId = company.id;

        const secondCompany =
            await prisma.company.create({
                data: {
                    name: `E2E Jobs Company B ${Date.now()}`,
                    slug: `e2e-jobs-company-b-${Date.now()}`,
                    description: 'Company B for jobs E2E tests',
                },
            });

        secondCompanyId = secondCompany.id;

        /*
         * Assign recruiters to companies.
         */

        await prisma.recruiter.update({
            where: {
                id: recruiterId,
            },
            data: {
                companyId,
            },
        });

        await prisma.recruiter.update({
            where: {
                id: secondRecruiterId,
            },
            data: {
                companyId: secondCompanyId,
            },
        });

        /*
         * ============================================================
         * Skills
         * ============================================================
         */

        const requiredSkill = await prisma.skill.create({
            data: {
                name: `E2E TypeScript ${Date.now()}`,
                slug: `e2e-typescript-${Date.now()}`,
                category: 'BACKEND',
                description:
                    'Required skill for jobs E2E tests',
            },
        });

        skillRequiredId = requiredSkill.id;

        const preferredSkill = await prisma.skill.create({
            data: {
                name: `E2E Docker ${Date.now()}`,
                slug: `e2e-docker-${Date.now()}`,
                category: 'DEVOPS',
                description:
                    'Preferred skill for jobs E2E tests',
            },
        });

        skillPreferredId = preferredSkill.id;

        const otherSkill = await prisma.skill.create({
            data: {
                name: `E2E PostgreSQL ${Date.now()}`,
                slug: `e2e-postgresql-${Date.now()}`,
                category: 'DATABASE',
                description:
                    'Additional skill for jobs E2E tests',
            },
        });

        skillOtherId = otherSkill.id;
    });

    /*
     * ================================================================
     * Authentication
     * ================================================================
     */

    describe('authentication', () => {
        it('should reject unauthenticated access to jobs', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/jobs')
                .expect(401);
        });

        it('should reject unauthenticated job creation', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .send({
                    title: 'Unauthenticated Job',
                    description:
                        'This job should not be created',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                })
                .expect(401);
        });

        it('should reject unauthenticated job retrieval', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/jobs/some-job-id')
                .expect(401);
        });
    });

    /*
     * ================================================================
     * Authorization
     * ================================================================
     */

    describe('authorization', () => {
        it('should reject a candidate from accessing jobs', async () => {
            await request(app.getHttpServer())
                .get('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(403);
        });

        it('should reject a candidate from creating a job', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .send({
                    title: 'Candidate Job',
                    description:
                        'Candidate should not create jobs',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                })
                .expect(403);
        });
    });

    /*
     * ================================================================
     * Job creation
     * ================================================================
     */

    describe('create job', () => {
        it('should create a draft job for the recruiter company', async () => {
            const response =
                await request(app.getHttpServer())
                    .post('/api/v1/jobs')
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        title: 'Backend Developer',
                        description:
                            'Build and maintain backend services for the platform.',
                        location: 'Amsterdam',
                        employmentType: 'FULL_TIME',
                        workMode: 'HYBRID',
                        salaryMin: 4000,
                        salaryMax: 6000,
                        currency: 'EUR',
                        requiredSkillIds: [
                            skillRequiredId,
                        ],
                        preferredSkillIds: [
                            skillPreferredId,
                        ],
                    })
                    .expect(201);

            expect(response.body).toMatchObject({
                companyId,
                createdByRecruiterId: recruiterId,
                title: 'Backend Developer',
                description:
                    'Build and maintain backend services for the platform.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                status: 'DRAFT',
            });

            expect(response.body.id).toEqual(
                expect.any(String),
            );

            jobId = response.body.id;
        });

        it('should persist the job in the database', async () => {
            const job = await prisma.job.findUnique({
                where: {
                    id: jobId,
                },
            });

            expect(job).not.toBeNull();
            expect(job?.companyId).toBe(companyId);
            expect(job?.createdByRecruiterId).toBe(
                recruiterId,
            );
            expect(job?.status).toBe('DRAFT');
        });

        it('should create required and preferred requirements', async () => {
            const requirements =
                await prisma.jobRequirement.findMany({
                    where: {
                        jobId,
                    },
                    orderBy: {
                        required: 'desc',
                    },
                });

            expect(requirements).toHaveLength(2);

            const required = requirements.find(
                (requirement) =>
                    requirement.skillId === skillRequiredId,
            );

            const preferred = requirements.find(
                (requirement) =>
                    requirement.skillId === skillPreferredId,
            );

            expect(required).toMatchObject({
                skillId: skillRequiredId,
                required: true,
                minimumLevel: 1,
            });

            expect(preferred).toMatchObject({
                skillId: skillPreferredId,
                required: false,
                minimumLevel: 1,
            });
        });

        it('should reject salaryMax lower than salaryMin', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    title: 'Invalid Salary Job',
                    description:
                        'This job has an invalid salary range.',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                    salaryMin: 7000,
                    salaryMax: 5000,
                })
                .expect(400);
        });

        it('should reject duplicate required skills', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    title: 'Duplicate Skills Job',
                    description:
                        'This job contains duplicate required skills.',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                    requiredSkillIds: [
                        skillRequiredId,
                        skillRequiredId,
                    ],
                })
                .expect(400);
        });

        it('should reject a skill being both required and preferred', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    title: 'Overlapping Skills Job',
                    description:
                        'This job contains overlapping skill requirements.',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                    requiredSkillIds: [
                        skillRequiredId,
                    ],
                    preferredSkillIds: [
                        skillRequiredId,
                    ],
                })
                .expect(400);
        });

        it('should reject a non-existing skill', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/jobs')
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    title: 'Unknown Skill Job',
                    description:
                        'This job references a skill that does not exist.',
                    employmentType: 'FULL_TIME',
                    workMode: 'REMOTE',
                    requiredSkillIds: [
                        '11111111-1111-4111-8111-111111111111',
                    ],
                })
                .expect(400);
        });
    });

    /*
     * ================================================================
     * Get jobs
     * ================================================================
     */

    describe('get jobs', () => {
        it('should return jobs belonging to the recruiter company', async () => {
            const response =
                await request(app.getHttpServer())
                    .get('/api/v1/jobs')
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .expect(200);

            expect(response.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: jobId,
                        companyId,
                    }),
                ]),
            );

            expect(
                response.body.every(
                    (job: any) =>
                        job.companyId === companyId,
                ),
            ).toBe(true);
        });

        it('should return the job by ID', async () => {
            const response =
                await request(app.getHttpServer())
                    .get(`/api/v1/jobs/${jobId}`)
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .expect(200);

            expect(response.body).toMatchObject({
                id: jobId,
                companyId,
                title: 'Backend Developer',
            });

            expect(response.body.requirements).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        skillId: skillRequiredId,
                        required: true,
                    }),
                    expect.objectContaining({
                        skillId: skillPreferredId,
                        required: false,
                    }),
                ]),
            );
        });

        it('should return 404 for a non-existing job', async () => {
            await request(app.getHttpServer())
                .get(
                    '/api/v1/jobs/11111111-1111-4111-8111-111111111111',
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(404);
        });
    });

    /*
     * ================================================================
     * Company isolation
     * ================================================================
     */

    describe('company isolation', () => {
        it('should not expose recruiter A jobs to recruiter B', async () => {
            const response =
                await request(app.getHttpServer())
                    .get('/api/v1/jobs')
                    .set(
                        'Authorization',
                        `Bearer ${secondRecruiterToken}`,
                    )
                    .expect(200);

            expect(
                response.body.some(
                    (job: any) => job.id === jobId,
                ),
            ).toBe(false);
        });

        it('should not allow recruiter B to retrieve recruiter A job', async () => {
            await request(app.getHttpServer())
                .get(`/api/v1/jobs/${jobId}`)
                .set(
                    'Authorization',
                    `Bearer ${secondRecruiterToken}`,
                )
                .expect(404);
        });

        it('should not allow recruiter B to update recruiter A job', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/jobs/${jobId}`)
                .set(
                    'Authorization',
                    `Bearer ${secondRecruiterToken}`,
                )
                .send({
                    title: 'Unauthorized Update',
                })
                .expect(404);
        });
    });

    /*
     * ================================================================
     * Update job
     * ================================================================
     */

    describe('update job', () => {
        it('should update the job', async () => {
            const response =
                await request(app.getHttpServer())
                    .patch(`/api/v1/jobs/${jobId}`)
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        title: 'Senior Backend Developer',
                        location: 'Rotterdam',
                        salaryMin: 4500,
                        salaryMax: 6500,
                    })
                    .expect(200);

            expect(response.body).toMatchObject({
                id: jobId,
                title: 'Senior Backend Developer',
                location: 'Rotterdam',
            });
        });

        it('should reject an invalid resulting salary range', async () => {
            await request(app.getHttpServer())
                .patch(`/api/v1/jobs/${jobId}`)
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    salaryMin: 8000,
                    salaryMax: 5000,
                })
                .expect(400);
        });

        it('should replace requirements when skill arrays are provided', async () => {
            const response =
                await request(app.getHttpServer())
                    .patch(`/api/v1/jobs/${jobId}`)
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        requiredSkillIds: [
                            skillOtherId,
                        ],
                        preferredSkillIds: [
                            skillPreferredId,
                        ],
                    })
                    .expect(200);

            expect(response.body.id).toBe(jobId);

            const requirements =
                await prisma.jobRequirement.findMany({
                    where: {
                        jobId,
                    },
                });

            expect(requirements).toHaveLength(2);

            expect(requirements).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        skillId: skillOtherId,
                        required: true,
                    }),
                    expect.objectContaining({
                        skillId: skillPreferredId,
                        required: false,
                    }),
                ]),
            );
        });
    });

    /*
     * ================================================================
     * Requirements endpoints
     * ================================================================
     */

    describe('job requirements', () => {
        it('should get all job requirements', async () => {
            const response =
                await request(app.getHttpServer())
                    .get(
                        `/api/v1/jobs/${jobId}/requirements`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .expect(200);

            expect(response.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        skillId: skillOtherId,
                        required: true,
                    }),
                    expect.objectContaining({
                        skillId: skillPreferredId,
                        required: false,
                    }),
                ]),
            );
        });

        it('should add one job requirement', async () => {
            const response =
                await request(app.getHttpServer())
                    .post(
                        `/api/v1/jobs/${jobId}/requirements`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        skillId: skillRequiredId,
                        required: true,
                        minimumLevel: 3,
                    })
                    .expect(201);

            expect(response.body).toMatchObject({
                jobId,
                skillId: skillRequiredId,
                required: true,
                minimumLevel: 3,
            });

            requirementId = response.body.id;

            expect(requirementId).toEqual(
                expect.any(String),
            );
        });

        it('should update one job requirement', async () => {
            const response =
                await request(app.getHttpServer())
                    .patch(
                        `/api/v1/jobs/${jobId}/requirements/${requirementId}`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        required: false,
                        minimumLevel: 4,
                    })
                    .expect(200);

            expect(response.body).toMatchObject({
                id: requirementId,
                jobId,
                skillId: skillRequiredId,
                required: false,
                minimumLevel: 4,
            });
        });

        it('should replace all job requirements', async () => {
            const response =
                await request(app.getHttpServer())
                    .patch(
                        `/api/v1/jobs/${jobId}/requirements`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .send({
                        requiredSkillIds: [
                            skillRequiredId,
                        ],
                        preferredSkillIds: [
                            skillOtherId,
                        ],
                    })
                    .expect(200);

            expect(response.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        skillId: skillRequiredId,
                        required: true,
                    }),
                    expect.objectContaining({
                        skillId: skillOtherId,
                        required: false,
                    }),
                ]),
            );

            expect(response.body).toHaveLength(2);
        });

        it('should remove one job requirement', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/api/v1/jobs/${jobId}/requirements/${skillOtherId}`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(200);

            const requirement =
                await prisma.jobRequirement.findUnique({
                    where: {
                        jobId_skillId: {
                            jobId,
                            skillId: skillOtherId,
                        },
                    },
                });

            expect(requirement).toBeNull();
        });

        it('should reject a non-existing requirement', async () => {
            await request(app.getHttpServer())
                .delete(
                    `/api/v1/jobs/${jobId}/requirements/${skillOtherId}`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(404);
        });
    });

    /*
     * ================================================================
     * Publish / close
     * ================================================================
     */

    describe('publish and close', () => {
        it('should publish a draft job', async () => {
            const response =
                await request(app.getHttpServer())
                    .post(
                        `/api/v1/jobs/${jobId}/publish`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .expect(201);

            expect(response.body).toMatchObject({
                id: jobId,
                status: 'PUBLISHED',
            });

            expect(response.body.publishedAt).toEqual(
                expect.any(String),
            );
        });

        it('should not publish an already published job', async () => {
            await request(app.getHttpServer())
                .post(
                    `/api/v1/jobs/${jobId}/publish`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(400);
        });

        it('should close a published job', async () => {
            const response =
                await request(app.getHttpServer())
                    .post(
                        `/api/v1/jobs/${jobId}/close`,
                    )
                    .set(
                        'Authorization',
                        `Bearer ${recruiterToken}`,
                    )
                    .expect(201);

            expect(response.body).toMatchObject({
                id: jobId,
                status: 'CLOSED',
            });
        });

        it('should not close an already closed job', async () => {
            await request(app.getHttpServer())
                .post(
                    `/api/v1/jobs/${jobId}/close`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(400);
        });
    });

    /*
     * ================================================================
     * Second recruiter can create own job
     * ================================================================
     */

    describe('second recruiter ownership', () => {
        it('should allow recruiter B to create their own job', async () => {
            const response =
                await request(app.getHttpServer())
                    .post('/api/v1/jobs')
                    .set(
                        'Authorization',
                        `Bearer ${secondRecruiterToken}`,
                    )
                    .send({
                        title: 'Frontend Developer',
                        description:
                            'Frontend developer for company B.',
                        employmentType: 'FULL_TIME',
                        workMode: 'REMOTE',
                        requiredSkillIds: [
                            skillRequiredId,
                        ],
                    })
                    .expect(201);

            expect(response.body).toMatchObject({
                companyId: secondCompanyId,
                createdByRecruiterId: secondRecruiterId,
                title: 'Frontend Developer',
                status: 'DRAFT',
            });

            secondJobId = response.body.id;
        });

        it('should only return recruiter B jobs for recruiter B', async () => {
            const response =
                await request(app.getHttpServer())
                    .get('/api/v1/jobs')
                    .set(
                        'Authorization',
                        `Bearer ${secondRecruiterToken}`,
                    )
                    .expect(200);

            expect(
                response.body.some(
                    (job: any) => job.id === secondJobId,
                ),
            ).toBe(true);

            expect(
                response.body.some(
                    (job: any) => job.id === jobId,
                ),
            ).toBe(false);

            expect(
                response.body.every(
                    (job: any) =>
                        job.companyId === secondCompanyId,
                ),
            ).toBe(true);
        });
    });

    /*
     * ================================================================
     * Cleanup
     * ================================================================
     */

    afterAll(async () => {
        /*
         * Requirements first.
         */
        if (jobId || secondJobId) {
            await prisma.jobRequirement.deleteMany({
                where: {
                    jobId: {
                        in: [jobId, secondJobId].filter(
                            Boolean,
                        ),
                    },
                },
            });
        }

        /*
         * Jobs.
         */
        await prisma.job.deleteMany({
            where: {
                id: {
                    in: [jobId, secondJobId].filter(
                        Boolean,
                    ),
                },
            },
        });

        /*
         * Recruiters.
         */
        if (recruiterId) {
            await prisma.recruiter.delete({
                where: {
                    id: recruiterId,
                },
            });
        }

        if (secondRecruiterId) {
            await prisma.recruiter.delete({
                where: {
                    id: secondRecruiterId,
                },
            });
        }

        /*
         * Companies.
         */
        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [companyId, secondCompanyId].filter(
                        Boolean,
                    ),
                },
            },
        });

        /*
         * Skills.
         */
        await prisma.skill.deleteMany({
            where: {
                id: {
                    in: [
                        skillRequiredId,
                        skillPreferredId,
                        skillOtherId,
                    ].filter(Boolean),
                },
            },
        });

        /*
         * Users.
         */
        await prisma.user.deleteMany({
            where: {
                id: {
                    in: [
                        recruiterUserId,
                        secondRecruiterUserId,
                        candidateUserId,
                    ].filter(Boolean),
                },
            },
        });

        await app.close();
    });
});