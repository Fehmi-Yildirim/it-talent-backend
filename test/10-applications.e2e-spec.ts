import { INestApplication } from '@nestjs/common'
import { PrismaService } from '../src/database/prisma.service'
import request from 'supertest'
import * as argon2 from 'argon2'
import {
    existsSync,
    mkdtempSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestApp } from './helpers/create-test-app'

interface LoginResponse {
    accessToken: string
    user: {
        id: string
        email: string
    }
}

interface ApplicationResponse {
    id: string
    jobId: string
    candidateId: string
    status: string
    coverLetter?: string | null
    cvUrl?: string | null
    createdAt: string
    updatedAt: string
}

interface CandidateResponse {
    id: string
    userId: string
    cvOriginalName?: string | null
    cvMimeType?: string | null
    cvSize?: number | null
    cvExpiresAt?: string | null
    cvRetentionConsent?: boolean
    cvConsentAt?: string | null
    cvUrl?: string | null
}

interface CvRetentionSettingResponse {
    days: number
}

interface CandidateApplicationResponse
    extends ApplicationResponse {
    job: {
        id: string
        title: string
        location: string
        employmentType: string
        workMode: string
        company: {
            id: string
            name: string
            slug: string
        }
    }
}

interface ApplicationDetailResponse
    extends ApplicationResponse {
    job: {
        id: string
        title: string
        description: string
        location: string
        employmentType: string
        workMode: string
        company: {
            id: string
            name: string
            slug: string
        }
    }
}

interface RecruiterApplicationResponse
    extends ApplicationResponse {
    job: {
        id: string
        title: string
        companyId?: string
        company: {
            id: string
            name: string
            slug: string
        }
    }
    candidate: {
        id: string
        headline?: string | null
        summary?: string | null
        location?: string | null
    }
}

describe('10 - Applications (e2e)', () => {
    let app: INestApplication
    let prisma: PrismaService

    let candidateToken: string
    let secondCandidateToken: string
    let recruiterToken: string
    let secondRecruiterToken: string
    let adminToken: string

    let candidateUserId: string
    let secondCandidateUserId: string
    let recruiterUserId: string
    let secondRecruiterUserId: string
    let adminUserId: string

    let candidateId: string
    let secondCandidateId: string

    let companyId: string
    let secondCompanyId: string

    let publishedJobId: string
    let secondPublishedJobId: string
    let draftJobId: string
    let expiredJobId: string

    let applicationId: string
    let secondCandidateApplicationId: string
    let withdrawnApplicationId: string

    let previousCvUploadDir: string | undefined
    let testCvUploadDir: string

    const firstCvBuffer = Buffer.from(
        '%PDF-1.4 first test CV',
    )

    const replacementCvBuffer = Buffer.from(
        '%PDF-1.4 replacement test CV',
    )

    const secondCandidateCvBuffer = Buffer.from(
        '%PDF-1.4 second candidate CV',
    )

    beforeAll(async () => {
        previousCvUploadDir =
            process.env.CV_UPLOAD_DIR

        testCvUploadDir = mkdtempSync(
            join(
                tmpdir(),
                'it-talent-cvs-',
            ),
        )

        process.env.CV_UPLOAD_DIR =
            testCvUploadDir

        app = await createTestApp()
        prisma = app.get(PrismaService)

        const timestamp = Date.now()

        const candidatePassword =
            'Candidate12345!'
        const candidatePasswordHash =
            await argon2.hash(
                candidatePassword,
            )

        const candidateUser =
            await prisma.user.create({
                data: {
                    email: `e2e-application-candidate-${timestamp}@example.com`,
                    passwordHash:
                        candidatePasswordHash,
                    firstName: 'Test',
                    lastName: 'Candidate',
                    role: 'CANDIDATE',
                    status: 'ACTIVE',
                },
            })

        candidateUserId =
            candidateUser.id

        const candidate =
            await prisma.candidate.create({
                data: {
                    userId:
                        candidateUser.id,
                },
            })

        candidateId = candidate.id

        const candidateLogin =
            await request(
                app.getHttpServer(),
            )
                .post('/api/v1/auth/login')
                .send({
                    email:
                        candidateUser.email,
                    password:
                        candidatePassword,
                })
                .expect(201)

        candidateToken = (
            candidateLogin.body as LoginResponse
        ).accessToken

        const secondCandidatePassword =
            'Candidate12345!'
        const secondCandidatePasswordHash =
            await argon2.hash(
                secondCandidatePassword,
            )

        const secondCandidateUser =
            await prisma.user.create({
                data: {
                    email: `e2e-application-candidate-2-${timestamp}@example.com`,
                    passwordHash:
                        secondCandidatePasswordHash,
                    firstName: 'Test',
                    lastName: 'Candidate',
                    role: 'CANDIDATE',
                    status: 'ACTIVE',
                },
            })

        secondCandidateUserId =
            secondCandidateUser.id

        const secondCandidate =
            await prisma.candidate.create({
                data: {
                    userId:
                        secondCandidateUser.id,
                },
            })

        secondCandidateId =
            secondCandidate.id

        const secondCandidateLogin =
            await request(
                app.getHttpServer(),
            )
                .post('/api/v1/auth/login')
                .send({
                    email:
                        secondCandidateUser.email,
                    password:
                        secondCandidatePassword,
                })
                .expect(201)

        secondCandidateToken = (
            secondCandidateLogin.body as LoginResponse
        ).accessToken

        const recruiterPassword =
            'Recruiter12345!'
        const recruiterPasswordHash =
            await argon2.hash(
                recruiterPassword,
            )

        const recruiterUser =
            await prisma.user.create({
                data: {
                    email: `e2e-application-recruiter-${timestamp}@example.com`,
                    passwordHash:
                        recruiterPasswordHash,
                    firstName: 'Test',
                    lastName: 'Recruiter',
                    role: 'RECRUITER',
                    status: 'ACTIVE',
                },
            })

        recruiterUserId =
            recruiterUser.id

        const recruiter =
            await prisma.recruiter.create({
                data: {
                    userId:
                        recruiterUser.id,
                    jobTitle:
                        'Senior Recruiter',
                },
            })

        const recruiterLogin =
            await request(
                app.getHttpServer(),
            )
                .post('/api/v1/auth/login')
                .send({
                    email:
                        recruiterUser.email,
                    password:
                        recruiterPassword,
                })
                .expect(201)

        recruiterToken = (
            recruiterLogin.body as LoginResponse
        ).accessToken

        const secondRecruiterPassword =
            'Recruiter12345!'
        const secondRecruiterPasswordHash =
            await argon2.hash(
                secondRecruiterPassword,
            )

        const secondRecruiterUser =
            await prisma.user.create({
                data: {
                    email: `e2e-application-recruiter-2-${timestamp}@example.com`,
                    passwordHash:
                        secondRecruiterPasswordHash,
                    firstName: 'Test',
                    lastName: 'Recruiter',
                    role: 'RECRUITER',
                    status: 'ACTIVE',
                },
            })

        secondRecruiterUserId =
            secondRecruiterUser.id

        const secondRecruiter =
            await prisma.recruiter.create({
                data: {
                    userId:
                        secondRecruiterUser.id,
                    jobTitle: 'Recruiter',
                },
            })

        const secondRecruiterLogin =
            await request(
                app.getHttpServer(),
            )
                .post('/api/v1/auth/login')
                .send({
                    email:
                        secondRecruiterUser.email,
                    password:
                        secondRecruiterPassword,
                })
                .expect(201)

        secondRecruiterToken = (
            secondRecruiterLogin.body as LoginResponse
        ).accessToken

        const adminPassword =
            'Admin12345!'
        const adminPasswordHash =
            await argon2.hash(
                adminPassword,
            )

        const adminUser =
            await prisma.user.create({
                data: {
                    email: `e2e-application-admin-${timestamp}@example.com`,
                    passwordHash:
                        adminPasswordHash,
                    firstName: 'Test',
                    lastName: 'Admin',
                    role: 'ADMIN',
                    status: 'ACTIVE',
                },
            })

        adminUserId = adminUser.id

        const adminLogin =
            await request(
                app.getHttpServer(),
            )
                .post('/api/v1/auth/login')
                .send({
                    email:
                        adminUser.email,
                    password:
                        adminPassword,
                })
                .expect(201)

        adminToken = (
            adminLogin.body as LoginResponse
        ).accessToken

        const company =
            await prisma.company.create({
                data: {
                    name: `Application Company A ${timestamp}`,
                    slug: `application-company-a-${timestamp}`,
                    description:
                        'Primary application test company',
                    location: 'Amsterdam',
                },
            })

        companyId = company.id

        const secondCompany =
            await prisma.company.create({
                data: {
                    name: `Application Company B ${timestamp}`,
                    slug: `application-company-b-${timestamp}`,
                    description:
                        'Secondary application test company',
                    location: 'Rotterdam',
                },
            })

        secondCompanyId =
            secondCompany.id

        await prisma.recruiter.update({
            where: {
                id: recruiter.id,
            },
            data: {
                companyId,
            },
        })

        await prisma.recruiter.update({
            where: {
                id: secondRecruiter.id,
            },
            data: {
                companyId:
                    secondCompanyId,
            },
        })

        const publishedJob =
            await prisma.job.create({
                data: {
                    companyId,
                    createdByRecruiterId:
                        recruiter.id,
                    title:
                        'Senior Backend Developer',
                    description:
                        'Build backend applications.',
                    location: 'Amsterdam',
                    employmentType:
                        'FULL_TIME',
                    workMode: 'REMOTE',
                    salaryMin: 5000,
                    salaryMax: 7000,
                    currency: 'EUR',
                    status: 'PUBLISHED',
                    publishedAt:
                        new Date(),
                    expiresAt:
                        new Date(
                            Date.now() +
                            7 *
                            24 *
                            60 *
                            60 *
                            1000,
                        ),
                },
            })

        publishedJobId =
            publishedJob.id

        const secondPublishedJob =
            await prisma.job.create({
                data: {
                    companyId:
                        secondCompanyId,
                    createdByRecruiterId:
                        secondRecruiter.id,
                    title:
                        'Frontend Developer',
                    description:
                        'Build frontend applications.',
                    location: 'Rotterdam',
                    employmentType:
                        'FULL_TIME',
                    workMode: 'HYBRID',
                    salaryMin: 4000,
                    salaryMax: 6000,
                    currency: 'EUR',
                    status: 'PUBLISHED',
                    publishedAt:
                        new Date(),
                    expiresAt:
                        new Date(
                            Date.now() +
                            7 *
                            24 *
                            60 *
                            60 *
                            1000,
                        ),
                },
            })

        secondPublishedJobId =
            secondPublishedJob.id

        const draftJob =
            await prisma.job.create({
                data: {
                    companyId,
                    createdByRecruiterId:
                        recruiter.id,
                    title:
                        'Draft Developer',
                    description:
                        'This job is still a draft.',
                    location: 'Amsterdam',
                    employmentType:
                        'FULL_TIME',
                    workMode: 'REMOTE',
                    salaryMin: 4000,
                    salaryMax: 6000,
                    currency: 'EUR',
                    status: 'DRAFT',
                },
            })

        draftJobId = draftJob.id

        const expiredJob =
            await prisma.job.create({
                data: {
                    companyId,
                    createdByRecruiterId:
                        recruiter.id,
                    title:
                        'Expired Developer',
                    description:
                        'This job has expired.',
                    location: 'Amsterdam',
                    employmentType:
                        'FULL_TIME',
                    workMode: 'REMOTE',
                    salaryMin: 4000,
                    salaryMax: 6000,
                    currency: 'EUR',
                    status: 'PUBLISHED',
                    publishedAt:
                        new Date(
                            Date.now() -
                            14 *
                            24 *
                            60 *
                            60 *
                            1000,
                        ),
                    expiresAt:
                        new Date(
                            Date.now() -
                            24 *
                            60 *
                            60 *
                            1000,
                        ),
                },
            })

        expiredJobId = expiredJob.id
    })

    afterAll(async () => {
        await prisma.application.deleteMany({
            where: {
                candidateId: {
                    in: [
                        candidateId,
                        secondCandidateId,
                    ].filter(Boolean),
                },
            },
        })

        await prisma.job.deleteMany({
            where: {
                id: {
                    in: [
                        publishedJobId,
                        secondPublishedJobId,
                        draftJobId,
                        expiredJobId,
                    ].filter(Boolean),
                },
            },
        })

        await prisma.recruiter.deleteMany({
            where: {
                userId: {
                    in: [
                        recruiterUserId,
                        secondRecruiterUserId,
                    ].filter(Boolean),
                },
            },
        })

        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [
                        companyId,
                        secondCompanyId,
                    ].filter(Boolean),
                },
            },
        })

        await prisma.candidate.deleteMany({
            where: {
                id: {
                    in: [
                        candidateId,
                        secondCandidateId,
                    ].filter(Boolean),
                },
            },
        })

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: [
                        candidateUserId,
                        secondCandidateUserId,
                        recruiterUserId,
                        secondRecruiterUserId,
                        adminUserId,
                    ].filter(Boolean),
                },
            },
        })

        await app.close()

        rmSync(testCvUploadDir, {
            recursive: true,
            force: true,
        })

        if (
            previousCvUploadDir ===
            undefined
        ) {
            delete process.env
                .CV_UPLOAD_DIR
        } else {
            process.env.CV_UPLOAD_DIR =
                previousCvUploadDir
        }
    })

    it('01 - should reject unauthenticated application requests', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${publishedJobId}/applications`,
            )
            .send({
                coverLetter:
                    'I would love to join your team.',
            })
            .expect(401)
    })

    it('02 - should reject an application when the candidate has no current CV', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${publishedJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'I do not have a CV yet.',
            })
            .expect(409)
    })

    it('03 - should allow a candidate to upload their current CV', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    '/api/v1/candidates/me/cv',
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .attach(
                    'cv',
                    firstCvBuffer,
                    {
                        filename:
                            'candidate-cv-first.pdf',
                        contentType:
                            'application/pdf',
                    },
                )
                .expect(201)) as unknown as {
                    body: CandidateResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: candidateId,
            cvOriginalName:
                'candidate-cv-first.pdf',
            cvMimeType:
                'application/pdf',
            cvSize:
                firstCvBuffer.length,
            cvRetentionConsent:
                true,
            cvUrl:
                '/api/v1/candidates/me/cv',
        })

        expect(
            response.body.cvConsentAt,
        ).toBeTruthy()

        expect(
            response.body.cvExpiresAt,
        ).toBeTruthy()

        const storedCandidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id: candidateId,
                    },
                },
            )

        expect(
            storedCandidate,
        ).not.toBeNull()

        expect(
            storedCandidate?.cvPath,
        ).toBeTruthy()

        if (
            !storedCandidate?.cvPath
        ) {
            throw new Error(
                'Candidate CV path was not stored',
            )
        }

        expect(
            existsSync(
                join(
                    testCvUploadDir,
                    storedCandidate.cvPath,
                ),
            ),
        ).toBe(true)
    })

    it('04 - should allow a candidate to submit an application using their current CV', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    `/api/v1/jobs/${publishedJobId}/applications`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .send({
                    coverLetter:
                        'I would love to join your team.',
                })
                .expect(201)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            jobId:
                publishedJobId,
            candidateId,
            status: 'PENDING',
            coverLetter:
                'I would love to join your team.',
            cvUrl:
                `/api/v1/applications/${response.body.id}/cv`,
        })

        expect(
            response.body.id,
        ).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvOriginalName',
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvMimeType',
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvSize',
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvExpiresAt',
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvRetentionConsent',
        )

        expect(
            response.body,
        ).not.toHaveProperty(
            'cvConsentAt',
        )

        applicationId =
            response.body.id

        const storedApplication =
            await prisma.application.findUnique(
                {
                    where: {
                        id: applicationId,
                    },
                },
            )

        expect(
            storedApplication,
        ).not.toBeNull()

        if (
            !storedApplication
        ) {
            throw new Error(
                'Application was not created',
            )
        }

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvPath',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvOriginalName',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvMimeType',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvSize',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvExpiresAt',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvRetentionConsent',
        )

        expect(
            Object.keys(
                storedApplication,
            ),
        ).not.toContain(
            'cvConsentAt',
        )
    })

    it('05 - should reject a duplicate application', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${publishedJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'Duplicate application.',
            })
            .expect(409)
    })

    it('06 - should allow another candidate to use their own current CV for the same job', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${secondCandidateToken}`,
            )
            .attach(
                'cv',
                secondCandidateCvBuffer,
                {
                    filename:
                        'second-candidate-cv.pdf',
                    contentType:
                        'application/pdf',
                },
            )
            .expect(201)

        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    `/api/v1/jobs/${publishedJobId}/applications`,
                )
                .set(
                    'Authorization',
                    `Bearer ${secondCandidateToken}`,
                )
                .send({
                    coverLetter:
                        'I am also interested in this position.',
                })
                .expect(201)) as unknown as {
                    body: ApplicationResponse
                }

        secondCandidateApplicationId =
            response.body.id

        expect(
            response.body,
        ).toMatchObject({
            jobId:
                publishedJobId,
            candidateId:
                secondCandidateId,
            status: 'PENDING',
            cvUrl:
                `/api/v1/applications/${response.body.id}/cv`,
        })
    })

    it('07 - should reject applications for a draft job', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${draftJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'This should not be accepted.',
            })
            .expect(409)
    })

    it('08 - should reject applications for an expired job', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${expiredJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'This job has already expired.',
            })
            .expect(409)
    })

    it('09 - should allow a candidate to view their applications', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .get(
                    '/api/v1/applications',
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(200)) as unknown as {
                    body: CandidateApplicationResponse[]
                }

        expect(
            Array.isArray(
                response.body,
            ),
        ).toBe(true)

        const application =
            response.body.find(
                (item) =>
                    item.id ===
                    applicationId,
            )

        expect(
            application,
        ).toBeDefined()

        expect(
            application?.job.id,
        ).toBe(publishedJobId)

        expect(
            application?.cvUrl,
        ).toBe(
            `/api/v1/applications/${applicationId}/cv`,
        )
    })

    it('10 - should allow a candidate to view their own application', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/applications/${applicationId}`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(200)) as unknown as {
                    body: ApplicationDetailResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: applicationId,
            candidateId,
            job: {
                id: publishedJobId,
                title:
                    'Senior Backend Developer',
            },
        })

        expect(
            response.body.cvUrl,
        ).toBe(
            `/api/v1/applications/${applicationId}/cv`,
        )
    })

    it('11 - should prevent a candidate from viewing another candidate application', async () => {
        expect(
            secondCandidateApplicationId,
        ).toBeTruthy()

        await request(
            app.getHttpServer(),
        )
            .get(
                `/api/v1/applications/${secondCandidateApplicationId}`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(403)
    })

    it('12 - should allow a recruiter to view applications for their company', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .get(
                    '/api/v1/recruiter/applications',
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(200)) as unknown as {
                    body: RecruiterApplicationResponse[]
                }

        expect(
            Array.isArray(
                response.body,
            ),
        ).toBe(true)

        const application =
            response.body.find(
                (item) =>
                    item.id ===
                    applicationId,
            )

        expect(
            application,
        ).toBeDefined()

        expect(
            application?.job.id,
        ).toBe(publishedJobId)

        expect(
            application?.job.company.id,
        ).toBe(companyId)

        expect(
            application?.candidate.id,
        ).toBe(candidateId)

        expect(
            application?.cvUrl,
        ).toBe(
            `/api/v1/applications/${applicationId}/cv`,
        )
    })

    it('13 - should prevent another recruiter from viewing the application', async () => {
        await request(
            app.getHttpServer(),
        )
            .get(
                `/api/v1/recruiter/applications/${applicationId}`,
            )
            .set(
                'Authorization',
                `Bearer ${secondRecruiterToken}`,
            )
            .expect(403)
    })

    it('14 - should allow the recruiter to view an application from their company', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/recruiter/applications/${applicationId}`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(200)) as unknown as {
                    body: RecruiterApplicationResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: applicationId,
            job: {
                id: publishedJobId,
                companyId,
            },
            candidate: {
                id: candidateId,
            },
        })

        expect(
            response.body.cvUrl,
        ).toBe(
            `/api/v1/applications/${applicationId}/cv`,
        )
    })

    it('15 - should allow the candidate and recruiter to access the candidate current CV through the application', async () => {
        const candidateCv =
            await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/applications/${applicationId}/cv`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(200)

        expect(
            candidateCv.headers[
            'content-type'
            ],
        ).toContain(
            'application/pdf',
        )

        expect(
            candidateCv.body,
        ).toEqual(
            firstCvBuffer,
        )

        const recruiterCv =
            await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/applications/${applicationId}/cv`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .expect(200)

        expect(
            recruiterCv.body,
        ).toEqual(
            firstCvBuffer,
        )
    })

    it('16 - should allow the recruiter to move an application to REVIEWING', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .patch(
                    `/api/v1/recruiter/applications/${applicationId}/status`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    status: 'REVIEWING',
                })
                .expect(200)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: applicationId,
            status: 'REVIEWING',
        })
    })

    it('17 - should allow the recruiter to accept an application', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .patch(
                    `/api/v1/recruiter/applications/${applicationId}/status`,
                )
                .set(
                    'Authorization',
                    `Bearer ${recruiterToken}`,
                )
                .send({
                    status: 'ACCEPTED',
                })
                .expect(200)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: applicationId,
            status: 'ACCEPTED',
        })
    })

    it('18 - should reject an invalid status transition', async () => {
        await request(
            app.getHttpServer(),
        )
            .patch(
                `/api/v1/recruiter/applications/${applicationId}/status`,
            )
            .set(
                'Authorization',
                `Bearer ${recruiterToken}`,
            )
            .send({
                status: 'PENDING',
            })
            .expect(400)
    })

    it('19 - should prevent another recruiter from changing the application status', async () => {
        await request(
            app.getHttpServer(),
        )
            .patch(
                `/api/v1/recruiter/applications/${applicationId}/status`,
            )
            .set(
                'Authorization',
                `Bearer ${secondRecruiterToken}`,
            )
            .send({
                status: 'REJECTED',
            })
            .expect(403)
    })

    it('20 - should reject an invalid job UUID', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                '/api/v1/jobs/not-a-uuid/applications',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'Invalid job ID.',
            })
            .expect(400)
    })

    it('21 - should reject an invalid application UUID', async () => {
        await request(
            app.getHttpServer(),
        )
            .get(
                '/api/v1/applications/not-a-uuid',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(400)
    })

    it('22 - should reject an invalid application status', async () => {
        await request(
            app.getHttpServer(),
        )
            .patch(
                `/api/v1/recruiter/applications/${applicationId}/status`,
            )
            .set(
                'Authorization',
                `Bearer ${recruiterToken}`,
            )
            .send({
                status: 'INVALID',
            })
            .expect(400)
    })

    it('23 - should allow a candidate to reuse the same current CV for another job', async () => {
        const before =
            await prisma.candidate.findUnique({
                where: {
                    id: candidateId,
                },
                select: {
                    cvPath: true,
                    cvOriginalName: true,
                },
            })

        expect(
            before?.cvPath,
        ).toBeTruthy()

        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    `/api/v1/jobs/${secondPublishedJobId}/applications`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .send({
                    coverLetter:
                        'I would also like to apply for this position using my current CV.',
                })
                .expect(201)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            jobId:
                secondPublishedJobId,
            candidateId,
            status: 'PENDING',
            cvUrl:
                `/api/v1/applications/${response.body.id}/cv`,
        })

        expect(
            response.body.id,
        ).not.toBe(applicationId)

        const after =
            await prisma.candidate.findUnique({
                where: {
                    id: candidateId,
                },
                select: {
                    cvPath: true,
                    cvOriginalName: true,
                },
            })

        expect(
            after?.cvPath,
        ).toBe(before?.cvPath)

        expect(
            after?.cvOriginalName,
        ).toBe(
            before?.cvOriginalName,
        )
    })

    it('24 - should allow a candidate to withdraw and reapply using the same current CV', async () => {
        const firstResponse =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    `/api/v1/jobs/${secondPublishedJobId}/applications`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .send({
                    coverLetter:
                        'This should conflict because the candidate already applied to this job.',
                })
                .expect(409)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            firstResponse,
        ).toBeDefined()

        const existingApplication =
            await prisma.application.findUnique(
                {
                    where: {
                        candidateId_jobId: {
                            candidateId,
                            jobId:
                                secondPublishedJobId,
                        },
                    },
                },
            )

        expect(
            existingApplication,
        ).not.toBeNull()

        if (
            !existingApplication
        ) {
            throw new Error(
                'Expected second job application was not found',
            )
        }

        withdrawnApplicationId =
            existingApplication.id

        await request(
            app.getHttpServer(),
        )
            .patch(
                `/api/v1/applications/${withdrawnApplicationId}/withdraw`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(200)

        const reapplyResponse =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    `/api/v1/jobs/${secondPublishedJobId}/applications`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .send({
                    coverLetter:
                        'I would like to apply again using my same current CV.',
                })
                .expect(201)) as unknown as {
                    body: ApplicationResponse
                }

        expect(
            reapplyResponse.body,
        ).toMatchObject({
            id:
                withdrawnApplicationId,
            jobId:
                secondPublishedJobId,
            candidateId,
            status: 'PENDING',
            cvUrl:
                `/api/v1/applications/${withdrawnApplicationId}/cv`,
        })

        const applicationCount =
            await prisma.application.count({
                where: {
                    candidateId,
                    jobId:
                        secondPublishedJobId,
                },
            })

        expect(
            applicationCount,
        ).toBe(1)
    })

    it('25 - should allow a candidate to replace their current CV', async () => {
        const candidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id: candidateId,
                    },
                    select: {
                        cvPath: true,
                        cvOriginalName: true,
                    },
                },
            )

        expect(
            candidate?.cvPath,
        ).toBeTruthy()

        if (
            !candidate?.cvPath
        ) {
            throw new Error(
                'Current CV path was not stored',
            )
        }

        const oldCvPath =
            candidate.cvPath

        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    '/api/v1/candidates/me/cv',
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .attach(
                    'cv',
                    replacementCvBuffer,
                    {
                        filename:
                            'candidate-cv-replacement.pdf',
                        contentType:
                            'application/pdf',
                    },
                )
                .expect(201)) as unknown as {
                    body: CandidateResponse
                }

        expect(
            response.body,
        ).toMatchObject({
            id: candidateId,
            cvOriginalName:
                'candidate-cv-replacement.pdf',
            cvMimeType:
                'application/pdf',
            cvSize:
                replacementCvBuffer.length,
            cvRetentionConsent:
                true,
            cvUrl:
                '/api/v1/candidates/me/cv',
        })

        expect(
            existsSync(
                join(
                    testCvUploadDir,
                    oldCvPath,
                ),
            ),
        ).toBe(false)

        const storedCandidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id: candidateId,
                    },
                    select: {
                        cvPath: true,
                        cvOriginalName:
                            true,
                    },
                },
            )

        expect(
            storedCandidate?.cvPath,
        ).toBeTruthy()

        expect(
            storedCandidate?.cvPath,
        ).not.toBe(oldCvPath)

        expect(
            storedCandidate?.cvOriginalName,
        ).toBe(
            'candidate-cv-replacement.pdf',
        )

        if (
            !storedCandidate?.cvPath
        ) {
            throw new Error(
                'Replacement CV path was not stored',
            )
        }

        expect(
            existsSync(
                join(
                    testCvUploadDir,
                    storedCandidate.cvPath,
                ),
            ),
        ).toBe(true)

        const applicationCv =
            await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/applications/${applicationId}/cv`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(200)

        expect(
            applicationCv.body,
        ).toEqual(
            replacementCvBuffer,
        )

        const secondApplicationCv =
            await request(
                app.getHttpServer(),
            )
                .get(
                    `/api/v1/applications/${withdrawnApplicationId}/cv`,
                )
                .set(
                    'Authorization',
                    `Bearer ${candidateToken}`,
                )
                .expect(200)

        expect(
            secondApplicationCv.body,
        ).toEqual(
            replacementCvBuffer,
        )
    })

    it('26 - should allow a candidate to delete their current CV', async () => {
        const candidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id: candidateId,
                    },
                    select: {
                        cvPath: true,
                    },
                },
            )

        expect(
            candidate?.cvPath,
        ).toBeTruthy()

        if (
            !candidate?.cvPath
        ) {
            throw new Error(
                'Current CV path was not stored',
            )
        }

        const cvPath =
            candidate.cvPath

        await request(
            app.getHttpServer(),
        )
            .delete(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(200)

        expect(
            existsSync(
                join(
                    testCvUploadDir,
                    cvPath,
                ),
            ),
        ).toBe(false)

        const storedCandidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id: candidateId,
                    },
                },
            )

        expect(
            storedCandidate?.cvPath,
        ).toBeNull()

        expect(
            storedCandidate?.cvOriginalName,
        ).toBeNull()

        expect(
            storedCandidate?.cvMimeType,
        ).toBeNull()

        expect(
            storedCandidate?.cvSize,
        ).toBeNull()

        expect(
            storedCandidate?.cvExpiresAt,
        ).toBeNull()

        expect(
            storedCandidate?.cvRetentionConsent,
        ).toBe(false)

        expect(
            storedCandidate?.cvConsentAt,
        ).toBeNull()

        await request(
            app.getHttpServer(),
        )
            .get(
                `/api/v1/applications/${applicationId}`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(200)
            .expect((response) => {
                expect(
                    response.body.cvUrl,
                ).toBeNull()
            })

        await request(
            app.getHttpServer(),
        )
            .get(
                `/api/v1/applications/${applicationId}/cv`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .expect(404)
    })

    it('27 - should require a new current CV before creating another application', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${draftJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .send({
                coverLetter:
                    'There is no current CV.',
            })
            .expect(409)

        await request(
            app.getHttpServer(),
        )
            .post(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .attach(
                'cv',
                firstCvBuffer,
                {
                    filename:
                        'candidate-cv-restored.pdf',
                    contentType:
                        'application/pdf',
                },
            )
            .expect(201)
    })

    it('28 - should not allow one candidate to affect another candidate current CV', async () => {
        const before =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id:
                            secondCandidateId,
                    },
                    select: {
                        cvPath: true,
                        cvOriginalName:
                            true,
                    },
                },
            )

        expect(
            before?.cvPath,
        ).toBeTruthy()

        await request(
            app.getHttpServer(),
        )
            .post(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .attach(
                'cv',
                Buffer.from(
                    '%PDF-1.4 candidate one replacement',
                ),
                {
                    filename:
                        'candidate-one-current.pdf',
                    contentType:
                        'application/pdf',
                },
            )
            .expect(201)

        const after =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id:
                            secondCandidateId,
                    },
                    select: {
                        cvPath: true,
                        cvOriginalName:
                            true,
                    },
                },
            )

        expect(
            after?.cvPath,
        ).toBe(
            before?.cvPath,
        )

        expect(
            after?.cvOriginalName,
        ).toBe(
            before?.cvOriginalName,
        )
    })

    it('29 - should reject access to an expired current CV', async () => {
        const candidate =
            await prisma.candidate.findUnique(
                {
                    where: {
                        id:
                            secondCandidateId,
                    },
                    select: {
                        cvPath: true,
                    },
                },
            )

        expect(
            candidate?.cvPath,
        ).toBeTruthy()

        await prisma.candidate.update({
            where: {
                id:
                    secondCandidateId,
            },
            data: {
                cvExpiresAt:
                    new Date(
                        Date.now() -
                        60 *
                        1000,
                    ),
            },
        })

        await request(
            app.getHttpServer(),
        )
            .get(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${secondCandidateToken}`,
            )
            .expect(404)

        await request(
            app.getHttpServer(),
        )
            .post(
                `/api/v1/jobs/${expiredJobId}/applications`,
            )
            .set(
                'Authorization',
                `Bearer ${secondCandidateToken}`,
            )
            .send({
                coverLetter:
                    'The CV is expired.',
            })
            .expect(409)

        await request(
            app.getHttpServer(),
        )
            .get(
                `/api/v1/applications/${secondCandidateApplicationId}/cv`,
            )
            .set(
                'Authorization',
                `Bearer ${recruiterToken}`,
            )
            .expect(404)
    })

    it('30 - should reject unsupported CV uploads', async () => {
        await request(
            app.getHttpServer(),
        )
            .post(
                '/api/v1/candidates/me/cv',
            )
            .set(
                'Authorization',
                `Bearer ${candidateToken}`,
            )
            .attach(
                'cv',
                Buffer.from(
                    'not a CV',
                ),
                {
                    filename:
                        'notes.txt',
                    contentType:
                        'text/plain',
                },
            )
            .expect(400)
    })

    it('31 - should allow an admin to configure CV retention days', async () => {
        const response =
            (await request(
                app.getHttpServer(),
            )
                .patch(
                    '/api/v1/settings/cv-retention',
                )
                .set(
                    'Authorization',
                    `Bearer ${adminToken}`,
                )
                .send({
                    days: 90,
                })
                .expect(200)) as unknown as {
                    body: CvRetentionSettingResponse
                }

        expect(
            response.body.days,
        ).toBe(90)

        const publicResponse =
            (await request(
                app.getHttpServer(),
            )
                .get(
                    '/api/v1/settings/cv-retention',
                )
                .expect(200)) as unknown as {
                    body: CvRetentionSettingResponse
                }

        expect(
            publicResponse.body.days,
        ).toBe(90)
    })

    it('32 - should calculate current CV expiration using the configured retention period', async () => {
        await request(
            app.getHttpServer(),
        )
            .patch(
                '/api/v1/settings/cv-retention',
            )
            .set(
                'Authorization',
                `Bearer ${adminToken}`,
            )
            .send({
                days: 90,
            })
            .expect(200)

        const beforeUpload =
            Date.now()

        const response =
            (await request(
                app.getHttpServer(),
            )
                .post(
                    '/api/v1/candidates/me/cv',
                )
                .set(
                    'Authorization',
                    `Bearer ${secondCandidateToken}`,
                )
                .attach(
                    'cv',
                    Buffer.from(
                        '%PDF-1.4 configurable retention CV',
                    ),
                    {
                        filename:
                            'configurable-retention.pdf',
                        contentType:
                            'application/pdf',
                    },
                )
                .expect(201)) as unknown as {
                    body: CandidateResponse
                }

        expect(
            response.body.cvRetentionConsent,
        ).toBe(true)

        expect(
            response.body.cvConsentAt,
        ).toBeTruthy()

        expect(
            response.body.cvExpiresAt,
        ).toBeTruthy()

        const expiresAt =
            new Date(
                String(
                    response.body
                        .cvExpiresAt,
                ),
            )

        const expected =
            beforeUpload +
            90 *
            24 *
            60 *
            60 *
            1000

        expect(
            expiresAt.getTime(),
        ).toBeGreaterThan(
            expected - 60_000,
        )

        expect(
            expiresAt.getTime(),
        ).toBeLessThan(
            expected + 60_000,
        )

        await request(
            app.getHttpServer(),
        )
            .patch(
                '/api/v1/settings/cv-retention',
            )
            .set(
                'Authorization',
                `Bearer ${adminToken}`,
            )
            .send({
                days: 28,
            })
            .expect(200)
    })
})