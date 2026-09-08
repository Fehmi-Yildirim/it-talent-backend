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

interface DashboardResponse {
    profile: {
        status: string
        completionPercentage?: number
        company?: {
            id: string
            name: string
            slug: string
        } | null
    }
    applications: {
        total: number
        byStatus: Record<string, number>
        recent: unknown[]
    }
    jobs: {
        total?: number
        published?: number
        draft?: number
        closed?: number
        availableCount?: number
        recent: unknown[]
    }
    skills: {
        total: number
        items: unknown[]
    }
}

describe('11 - Dashboard (e2e)', () => {
    let app: INestApplication
    let prisma: PrismaService

    let candidateToken: string
    let recruiterToken: string
    let secondCandidateToken: string
    let secondRecruiterToken: string

    let candidateId: string
    let secondCandidateId: string
    let companyId: string
    let secondCompanyId: string

    beforeAll(async () => {
        app = await createTestApp()
        prisma = app.get(PrismaService)

        const timestamp = Date.now()

        const candidatePassword = 'Candidate12345!'
        const candidateHash = await argon2.hash(candidatePassword)

        const candidateUser = await prisma.user.create({
            data: {
                email: `e2e-dashboard-candidate-${timestamp}@example.com`,
                passwordHash: candidateHash,
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
        })

        const candidate = await prisma.candidate.create({
            data: {
                userId: candidateUser.id,
                headline: 'Backend Developer',
                summary: 'Experienced developer',
                location: 'Amsterdam',
                currency: 'EUR',
                remotePreference: 'HYBRID',
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

        const secondCandidateHash = await argon2.hash(candidatePassword)

        const secondCandidateUser = await prisma.user.create({
            data: {
                email: `e2e-dashboard-candidate-2-${timestamp}@example.com`,
                passwordHash: secondCandidateHash,
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
                password: candidatePassword,
            })
            .expect(201)

        secondCandidateToken =
            (secondCandidateLogin.body as LoginResponse).accessToken

        const recruiterPassword = 'Recruiter12345!'
        const recruiterHash = await argon2.hash(recruiterPassword)

        const recruiterUser = await prisma.user.create({
            data: {
                email: `e2e-dashboard-recruiter-${timestamp}@example.com`,
                passwordHash: recruiterHash,
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

        const secondRecruiterHash = await argon2.hash(recruiterPassword)

        const secondRecruiterUser = await prisma.user.create({
            data: {
                email: `e2e-dashboard-recruiter-2-${timestamp}@example.com`,
                passwordHash: secondRecruiterHash,
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
                password: recruiterPassword,
            })
            .expect(201)

        secondRecruiterToken =
            (secondRecruiterLogin.body as LoginResponse).accessToken

        const company = await prisma.company.create({
            data: {
                name: `Dashboard Company A ${timestamp}`,
                slug: `dashboard-company-a-${timestamp}`,
                location: 'Amsterdam',
            },
        })

        companyId = company.id

        const secondCompany = await prisma.company.create({
            data: {
                name: `Dashboard Company B ${timestamp}`,
                slug: `dashboard-company-b-${timestamp}`,
                location: 'Rotterdam',
            },
        })

        secondCompanyId = secondCompany.id

        await prisma.recruiter.update({
            where: { id: recruiter.id },
            data: { companyId },
        })

        await prisma.recruiter.update({
            where: { id: secondRecruiter.id },
            data: { companyId: secondCompanyId },
        })

        const job = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Backend Developer',
                description: 'Backend role',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        })

        const secondJob = await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Fullstack Developer',
                description: 'Fullstack role',
                employmentType: 'FULL_TIME',
                workMode: 'HYBRID',
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        })

        await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Draft Developer',
                description: 'Draft role',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                status: 'DRAFT',
            },
        })

        await prisma.job.create({
            data: {
                companyId,
                createdByRecruiterId: recruiter.id,
                title: 'Closed Developer',
                description: 'Closed role',
                employmentType: 'FULL_TIME',
                workMode: 'REMOTE',
                status: 'CLOSED',
            },
        })

        await prisma.application.create({
            data: {
                candidateId,
                jobId: job.id,
                status: 'PENDING',
            },
        })

        await prisma.application.create({
            data: {
                candidateId,
                jobId: secondJob.id,
                status: 'ACCEPTED',
            },
        })
    })

    afterAll(async () => {
        await prisma.application.deleteMany({
            where: {
                candidateId: {
                    in: [candidateId, secondCandidateId],
                },
            },
        })

        await prisma.job.deleteMany({
            where: {
                companyId: {
                    in: [companyId, secondCompanyId],
                },
            },
        })

        await prisma.recruiter.deleteMany({
            where: {
                companyId: {
                    in: [companyId, secondCompanyId],
                },
            },
        })

        await prisma.company.deleteMany({
            where: {
                id: {
                    in: [companyId, secondCompanyId],
                },
            },
        })

        await prisma.candidate.deleteMany({
            where: {
                id: {
                    in: [candidateId, secondCandidateId],
                },
            },
        })

        await app.close()
    })

    it('01 - rejects unauthenticated candidate dashboard access', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/candidates/me/dashboard')
            .expect(401)
    })

    it('02 - rejects unauthenticated recruiter dashboard access', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/recruiters/me/dashboard')
            .expect(401)
    })

    it('03 - returns candidate dashboard for authenticated candidate', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/dashboard')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(200)

        const body = response.body as DashboardResponse

        expect(body.profile.status).toBe('ACTIVE')
        expect(body.applications.total).toBe(2)

        expect(body.applications.byStatus).toEqual(
            expect.objectContaining({
                PENDING: 1,
                ACCEPTED: 1,
            }),
        )

        expect(body.applications.recent).toHaveLength(2)
        expect(body.jobs.availableCount).toBeGreaterThanOrEqual(2)
        expect(body.skills).toBeDefined()
    })

    it('04 - candidate dashboard does not expose another candidate data', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/dashboard')
            .set('Authorization', `Bearer ${secondCandidateToken}`)
            .expect(200)

        const body = response.body as DashboardResponse

        expect(body.applications.total).toBe(0)
        expect(body.applications.recent).toEqual([])
    })

    it('05 - rejects recruiter from candidate dashboard', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/candidates/me/dashboard')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(403)
    })

    it('06 - returns recruiter dashboard for authenticated recruiter', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/recruiters/me/dashboard')
            .set('Authorization', `Bearer ${recruiterToken}`)
            .expect(200)

        const body = response.body as DashboardResponse

        expect(body.profile.status).toBe('ACTIVE')
        expect(body.profile.company?.id).toBe(companyId)

        expect(body.jobs.total).toBe(4)
        expect(body.jobs.published).toBe(2)
        expect(body.jobs.draft).toBe(1)
        expect(body.jobs.closed).toBe(1)

        expect(body.applications.total).toBe(2)

        expect(body.applications.byStatus).toEqual(
            expect.objectContaining({
                PENDING: 1,
                ACCEPTED: 1,
            }),
        )

        expect(body.applications.recent).toHaveLength(2)
        expect(body.jobs.recent).toHaveLength(4)
    })

    it('07 - recruiter dashboard is scoped to the recruiter company', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/recruiters/me/dashboard')
            .set('Authorization', `Bearer ${secondRecruiterToken}`)
            .expect(200)

        const body = response.body as DashboardResponse

        expect(body.profile.company?.id).toBe(secondCompanyId)
        expect(body.jobs.total).toBe(0)
        expect(body.applications.total).toBe(0)
    })

    it('08 - rejects candidate from recruiter dashboard', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/recruiters/me/dashboard')
            .set('Authorization', `Bearer ${candidateToken}`)
            .expect(403)
    })
})
