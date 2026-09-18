import { INestApplication } from '@nestjs/common'
import { PrismaService } from '../src/database/prisma.service'
import request from 'supertest'
import * as argon2 from 'argon2'

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
    createdAt: string
    updatedAt: string
}

interface CandidateApplicationResponse extends ApplicationResponse {
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

interface ApplicationDetailResponse extends ApplicationResponse {
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

interface RecruiterApplicationResponse extends ApplicationResponse {
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

    let candidateId: string
    let secondCandidateId: string

    let companyId: string
    let secondCompanyId: string

    let publishedJobId: string
    let secondPublishedJobId: string
    let draftJobId: string
    let expiredJobId: string

    let applicationId: string

    beforeAll(async () => {
        app = await createTestApp()
        prisma = app.get(PrismaService)

        const timestamp = Date.now()

        // Candidate 1
        const candidatePassword = 'Candidate12345!'
        const candidatePasswordHash =
            await argon2.hash(candidatePassword)

        const candidateUser = await prisma.user.create({
            data: {
                email: `e2e-application-candidate-${timestamp}@example.com`,
                passwordHash: candidatePasswordHash,
                firstName: 'Test',
                lastName: 'Candidate',
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
        })

        const candidate = await prisma.candidate.create({
            data: {
                userId: candidateUser.id,
            },
        })

        candidateId = candidate.id

        const candidateLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: candidateUser.email,
                password: candidatePassword,
            })
            .expect(201)

        candidateToken =
            (candidateLogin.body as LoginResponse).accessToken

        // Candidate 2
        const secondCandidatePassword = 'Candidate12345!'
        const secondCandidatePasswordHash =
            await argon2.hash(secondCandidatePassword)

        const secondCandidateUser = await prisma.user.create({
            data: {
                email: `e2e-application-candidate-2-${timestamp}@example.com`,
                passwordHash: secondCandidatePasswordHash,
                firstName: 'Test',
                lastName: 'Candidate',
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
        })

        const secondCandidate = await prisma.candidate.create({
            data: {
                userId: secondCandidateUser.id,
            },
        })

        secondCandidateId = secondCandidate.id

        const secondCandidateLogin = await request(
            app.getHttpServer(),
        )
            .post('/api/v1/auth/login')
            .send({
                email: secondCandidateUser.email,
                password: secondCandidatePassword,
            })
            .expect(201)

        secondCandidateToken =
            (secondCandidateLogin.body as LoginResponse).accessToken

        // Recruiter 1
        const recruiterPassword = 'Recruiter12345!'
        const recruiterPasswordHash =
            await argon2.hash(recruiterPassword)

        const recruiterUser = await prisma.user.create({
            data: {
                email: `e2e-application-recruiter-${timestamp}@example.com`,
                passwordHash: recruiterPasswordHash,
                firstName: 'Test',
                lastName: 'Recruiter',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        })

        const recruiter = await prisma.recruiter.create({
            data: {
                userId: recruiterUser.id,
                jobTitle: 'Senior Recruiter',
            },
        })

        const recruiterLogin = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: recruiterUser.email,
                password: recruiterPassword,
            })
            .expect(201)

        recruiterToken =
            (recruiterLogin.body as LoginResponse).accessToken

        // Recruiter 2
        const secondRecruiterPassword = 'Recruiter12345!'
        const secondRecruiterPasswordHash =
            await argon2.hash(secondRecruiterPassword)

        const secondRecruiterUser = await prisma.user.create({
            data: {
                email: `e2e-application-recruiter-2-${timestamp}@example.com`,
                passwordHash: secondRecruiterPasswordHash,
                firstName: 'Test',
                lastName: 'Recruiter',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
        })

        const secondRecruiter = await prisma.recruiter.create({
            data: {
                userId: secondRecruiterUser.id,
                jobTitle: 'Recruiter',
            },
        })

        const secondRecruiterLogin = await request(
            app.getHttpServer(),
        )
            .post('/api/v1/auth/login')
            .send({
                email: secondRecruiterUser.email,
                password: secondRecruiterPassword,
            })
            .expect(201)

        secondRecruiterToken =
            (secondRecruiterLogin.body as LoginResponse).accessToken

        // Companies
        const company = await prisma.company.create({
            data: {
                name: `Application Company A ${timestamp}`,
                slug: `application-company-a-${timestamp}`,
                description: 'Primary application test company',
                location: 'Amsterdam',
            },
        })

        companyId = company.id

        const secondCompany = await prisma.company.create({
            data: {
                name: `Application Company B ${timestamp}`,
                slug: `application-company-b-${timestamp}`,
                description: 'Secondary application test company',
                location: 'Rotterdam',
            },
        })

        secondCompanyId = secondCompany.id

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
                companyId: secondCompanyId,
            },
        })

        // Published job - Company A
        const publishedJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Senior Backend Developer',
                description: 'Build backend applications.',
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
            },
        })

        publishedJobId = publishedJob.id

        // Published job - Company B
        const secondPublishedJob = await prisma.job.create({
            data: {
                companyId: secondCompanyId,
                createdByRecruiterId: secondRecruiter.id,
                title: 'Frontend Developer',
                description: 'Build frontend applications.',
                location: 'Rotterdam',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                salaryMin: 4000,
                salaryMax: 6000,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt: new Date(),
                expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                ),
            },
        })

        secondPublishedJobId = secondPublishedJob.id

        // Draft job
        const draftJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Draft Developer',
                description: 'This job is still a draft.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 4000,
                salaryMax: 6000,
                currency: 'EUR',
                status: 'DRAFT',
            },
        })

        draftJobId = draftJob.id

        // Expired job
        const expiredJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Expired Developer',
                description: 'This job has expired.',
                location: 'Amsterdam',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                salaryMin: 4000,
                salaryMax: 6000,
                currency: 'EUR',
                status: 'PUBLISHED',
                publishedAt: new Date(
                    Date.now() - 14 * 24 * 60 * 60 * 1000,
                ),
                expiresAt: new Date(
                    Date.now() - 24 * 60 * 60 * 1000,
                ),
            },
        })

        expiredJobId = expiredJob.id
    })

    afterAll(async () => {
        await prisma.application.deleteMany({
            where: {
                OR: [
                    { candidateId },
                    { candidateId: secondCandidateId },
                ],
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
                companyId: {
                    in: [companyId, secondCompanyId].filter(Boolean),
                },
            },
        })

        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [companyId, secondCompanyId].filter(Boolean),
                },
            },
        })

        await prisma.candidate.deleteMany({
            where: {
                id: {
                    in: [candidateId, secondCandidateId].filter(Boolean),
                },
            },
        })

        await app.close()
    })

    it('01 - should reject unauthenticated application requests', async () => {
        await request(app.getHttpServer())
            .post(`/api/v1/jobs/${publishedJobId}/applications`)
            .send({
                coverLetter: 'I would love to join your team.',
            })
            .expect(401)
    })

    it('02 - should allow a candidate to submit an application', async () => {
        const response = (await request(app.getHttpServer())
            .post(`/api/v1/jobs/${publishedJobId}/applications`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'I would love to join your team.',
            })
            .expect(201)) as unknown as { body: ApplicationResponse }

        expect(response.body).toMatchObject({
            jobId: publishedJobId,
            candidateId,
            status: 'PENDING',
            coverLetter: 'I would love to join your team.',
        })

        expect(response.body).toHaveProperty('id')
        expect(response.body).toHaveProperty('createdAt')
        expect(response.body).toHaveProperty('updatedAt')

        applicationId = response.body.id
    })

    it('03 - should reject a duplicate application', async () => {
        await request(app.getHttpServer())
            .post(`/api/v1/jobs/${publishedJobId}/applications`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'Duplicate application.',
            })
            .expect(409)
    })

    it('04 - should allow another candidate to apply to the same job', async () => {
        const response = (await request(app.getHttpServer())
            .post(`/api/v1/jobs/${publishedJobId}/applications`)
            .set('Authorization', `Bearer ${secondCandidateToken}`)
            .send({
                coverLetter: 'I am also interested in this position.',
            })
            .expect(201)) as unknown as { body: ApplicationResponse }

        expect(response.body).toMatchObject({
            jobId: publishedJobId,
            candidateId: secondCandidateId,
            status: 'PENDING',
        })
    })

    it('05 - should reject applications for a draft job', async () => {
        await request(app.getHttpServer())
            .post(`/api/v1/jobs/${draftJobId}/applications`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'This should not be accepted.',
            })
            .expect(409)
    })

    it('06 - should reject applications for an expired job', async () => {
        await request(app.getHttpServer())
            .post(`/api/v1/jobs/${expiredJobId}/applications`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'This job has already expired.',
            })
            .expect(409)
    })

    it('07 - should allow a candidate to view their applications', async () => {
        const response = (await request(app.getHttpServer())
            .get('/api/v1/applications')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200)) as unknown as {
                body: CandidateApplicationResponse[]
            }

        expect(Array.isArray(response.body)).toBe(true)

        const application = response.body.find(
            (item) => item.id === applicationId,
        )

        expect(application).toBeDefined()
        expect(application?.job.id).toBe(publishedJobId)
    })

    it('08 - should allow a candidate to view their own application', async () => {
        const response = (await request(app.getHttpServer())
            .get(`/api/v1/applications/${applicationId}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200)) as unknown as {
                body: ApplicationDetailResponse
            }

        expect(response.body).toMatchObject({
            id: applicationId,
            candidateId,
            job: {
                id: publishedJobId,
                title: 'Senior Backend Developer',
            },
        })
    })

    it('09 - should prevent a candidate from viewing another candidate application', async () => {
        const secondCandidateApplication =
            await prisma.application.findFirst({
                where: {
                    candidateId: secondCandidateId,
                    jobId: publishedJobId,
                },
            })

        expect(secondCandidateApplication).not.toBeNull()

        if (!secondCandidateApplication) {
            throw new Error('Second candidate application was not created')
        }

        await request(app.getHttpServer())
            .get(`/api/v1/applications/${secondCandidateApplication.id}`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(403)
    })

    it('10 - should allow a recruiter to view applications for their company', async () => {
        const response = (await request(app.getHttpServer())
            .get('/api/v1/recruiter/applications')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(200)) as unknown as {
                body: RecruiterApplicationResponse[]
            }

        expect(Array.isArray(response.body)).toBe(true)

        const application = response.body.find(
            (item) => item.id === applicationId,
        )

        expect(application).toBeDefined()
        expect(application?.job.id).toBe(publishedJobId)
        expect(application?.job.company.id).toBe(companyId)
    })

    it('11 - should prevent another recruiter from viewing the application', async () => {
        await request(app.getHttpServer())
            .get(`/api/v1/recruiter/applications/${applicationId}`)
            .set('Authorization', `Bearer ${secondRecruiterToken}`)
            .expect(403)
    })

    it('12 - should allow the recruiter to view an application from their company', async () => {
        const response = (await request(app.getHttpServer())
            .get(`/api/v1/recruiter/applications/${applicationId}`)
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(200)) as unknown as {
                body: RecruiterApplicationResponse
            }

        expect(response.body).toMatchObject({
            id: applicationId,
            job: {
                id: publishedJobId,
                companyId,
            },
            candidate: {
                id: candidateId,
            },
        })
    })

    it('13 - should allow the recruiter to move an application to REVIEWING', async () => {
        const response = (await request(app.getHttpServer())
            .patch(`/api/v1/recruiter/applications/${applicationId}/status`)
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                status: 'REVIEWING',
            })
            .expect(200)) as unknown as { body: ApplicationResponse }

        expect(response.body).toMatchObject({
            id: applicationId,
            status: 'REVIEWING',
        })
    })

    it('14 - should allow the recruiter to accept an application', async () => {
        const response = (await request(app.getHttpServer())
            .patch(`/api/v1/recruiter/applications/${applicationId}/status`)
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                status: 'ACCEPTED',
            })
            .expect(200)) as unknown as { body: ApplicationResponse }

        expect(response.body).toMatchObject({
            id: applicationId,
            status: 'ACCEPTED',
        })
    })

    it('15 - should reject an invalid status transition', async () => {
        await request(app.getHttpServer())
            .patch(`/api/v1/recruiter/applications/${applicationId}/status`)
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                status: 'PENDING',
            })
            .expect(400)
    })

    it('16 - should prevent another recruiter from changing the application status', async () => {
        await request(app.getHttpServer())
            .patch(`/api/v1/recruiter/applications/${applicationId}/status`)
            .set('Authorization', `Bearer ${secondRecruiterToken}`)
            .send({
                status: 'REJECTED',
            })
            .expect(403)
    })

    it('17 - should reject an invalid job UUID', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/jobs/not-a-uuid/applications')
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'Invalid job ID.',
            })
            .expect(400)
    })

    it('18 - should reject an invalid application UUID', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/applications/not-a-uuid')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(400)
    })

    it('19 - should reject an invalid application status', async () => {
        await request(app.getHttpServer())
            .patch(`/api/v1/recruiter/applications/${applicationId}/status`)
            .set('Authorization', `Bearer ${recruiterToken}`)
            .send({
                status: 'INVALID',
            })
            .expect(400)
    })

    it('20 - should allow a candidate to withdraw a pending application', async () => {
        const response = (await request(app.getHttpServer())
            .post(`/api/v1/jobs/${secondPublishedJobId}/applications`)
            .set('Authorization', `Bearer ${candidateToken}`)
            .send({
                coverLetter: 'I would like to apply and later withdraw.',
            })
            .expect(201)) as unknown as { body: ApplicationResponse }

        const withdrawApplicationId = response.body.id

        const withdrawResponse = (await request(
            app.getHttpServer(),
        )
            .patch(
                `/api/v1/applications/${withdrawApplicationId}/withdraw`,
            )
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200)) as unknown as { body: ApplicationResponse }

        expect(withdrawResponse.body).toMatchObject({
            id: withdrawApplicationId,
            status: 'WITHDRAWN',
        })
    })
})
