/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';
import * as argon2 from 'argon2';

import { createTestApp } from './helpers/create-test-app';

describe('05 - Recruiter & Company (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let recruiterToken: string;
  let userId: string;
  let recruiterId: string;
  let companyId: string;

  let candidateUserId: string;
  let candidateToken: string;

  let secondRecruiterUserId: string;
  let secondRecruiterId: string;
  let secondRecruiterToken: string;
  let secondCompanyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    /*
     * Primary recruiter
     */
    const email = `e2e-recruiter-${Date.now()}@example.com`;
    const password = 'Recruiter12345!';

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Test',
        lastName: 'Recruiter',
        role: 'RECRUITER',
        status: 'ACTIVE',
      },
    });

    userId = user.id;

    const recruiter = await prisma.recruiter.create({
      data: {
        user: {
          connect: {
            id: user.id,
          },
        },
        jobTitle: 'Senior Recruiter',
      },
    });

    recruiterId = recruiter.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    recruiterToken = loginResponse.body.accessToken;

    expect(recruiterToken).toEqual(expect.any(String));

    /*
     * Candidate used for authorization tests
     */
    const candidateEmail = `e2e-candidate-${Date.now()}@example.com`;
    const candidatePassword = 'Candidate12345!';

    const candidatePasswordHash = await argon2.hash(candidatePassword);

    const candidateUser = await prisma.user.create({
      data: {
        email: candidateEmail,
        passwordHash: candidatePasswordHash,
        firstName: 'Test',
        lastName: 'Candidate',
        role: 'CANDIDATE',
        status: 'ACTIVE',
      },
    });

    candidateUserId = candidateUser.id;

    const candidateLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: candidateEmail,
        password: candidatePassword,
      })
      .expect(201);

    candidateToken = candidateLoginResponse.body.accessToken;

    expect(candidateToken).toEqual(expect.any(String));

    /*
     * Second recruiter used for ownership isolation tests
     */
    const secondRecruiterEmail = `e2e-recruiter-second-${Date.now()}@example.com`;
    const secondRecruiterPassword = 'Recruiter12345!';

    const secondRecruiterPasswordHash = await argon2.hash(
      secondRecruiterPassword,
    );

    const secondUser = await prisma.user.create({
      data: {
        email: secondRecruiterEmail,
        passwordHash: secondRecruiterPasswordHash,
        firstName: 'Test',
        lastName: 'Recruiter',
        role: 'RECRUITER',
        status: 'ACTIVE',
      },
    });

    secondRecruiterUserId = secondUser.id;

    const secondRecruiter = await prisma.recruiter.create({
      data: {
        user: {
          connect: {
            id: secondUser.id,
          },
        },
        jobTitle: 'Recruiter Two',
      },
    });

    secondRecruiterId = secondRecruiter.id;

    const secondRecruiterLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: secondRecruiterEmail,
        password: secondRecruiterPassword,
      })
      .expect(201);

    secondRecruiterToken = secondRecruiterLoginResponse.body.accessToken;

    expect(secondRecruiterToken).toEqual(expect.any(String));
  });

  describe('authentication', () => {
    it('should reject unauthenticated company creation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/companies')
        .send({
          name: 'Unauthenticated Company',
          description: 'Should not be created',
        })
        .expect(401);
    });

    it('should reject unauthenticated company retrieval', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/companies/me')
        .expect(401);
    });

    it('should reject unauthenticated company update', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/companies/me')
        .send({
          description: 'Should not be updated',
        })
        .expect(401);
    });
  });

  describe('recruiter profile', () => {
    it('should retrieve the recruiter profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/recruiters/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: recruiterId,
        jobTitle: 'Senior Recruiter',
      });
    });

    it('should update the recruiter profile', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/recruiters/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          jobTitle: 'Lead Recruiter',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: recruiterId,
        jobTitle: 'Lead Recruiter',
      });
    });
  });

  describe('authorization', () => {
    it('should reject a candidate from creating a company', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          name: 'Candidate Company',
          description: 'Should not be created',
        })
        .expect(403);
    });

    it('should reject a candidate from retrieving a company', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/companies/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('should reject a candidate from updating a company', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/companies/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          description: 'Should not be updated',
        })
        .expect(403);
    });
  });

  describe('company', () => {
    it('should return 404 when recruiter has no company', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/companies/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(404);
    });

    it('should allow the recruiter to create a company', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          name: `E2E Company ${Date.now()}`,
          description: 'Company created during E2E testing',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        description: 'Company created during E2E testing',
      });

      expect(response.body.id).toEqual(expect.any(String));

      expect(response.body.slug).toEqual(expect.any(String));

      companyId = response.body.id;
    });

    it('should assign the recruiter to the created company', async () => {
      const recruiter = await prisma.recruiter.findUnique({
        where: {
          id: recruiterId,
        },
      });

      expect(recruiter).not.toBeNull();
      expect(recruiter?.companyId).toBe(companyId);
    });

    it('should reject a second company for the same recruiter', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          name: `Second E2E Company ${Date.now()}`,
          description: 'Should not be created',
        })
        .expect(409);
    });

    it('should retrieve the recruiter company', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/companies/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: companyId,
        description: 'Company created during E2E testing',
      });
    });

    it('should update the recruiter company', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/companies/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          description: 'Updated E2E company description',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: companyId,
        description: 'Updated E2E company description',
      });
    });

    it('should not expose a company DELETE endpoint', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/companies/me')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(404);
    });
  });

  describe('ownership isolation', () => {
    it('should allow a second recruiter to create their own company', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${secondRecruiterToken}`)
        .send({
          name: `E2E Second Company ${Date.now()}`,
          description: 'Second recruiter company',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        description: 'Second recruiter company',
      });

      secondCompanyId = response.body.id;

      expect(secondCompanyId).toEqual(expect.any(String));

      expect(secondCompanyId).not.toBe(companyId);
    });

    it('should return only the authenticated recruiter company', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/companies/me')
        .set('Authorization', `Bearer ${secondRecruiterToken}`)
        .expect(200);

      expect(response.body.id).toBe(secondCompanyId);
      expect(response.body.id).not.toBe(companyId);
    });

    it('should update only the authenticated recruiter company', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/companies/me')
        .set('Authorization', `Bearer ${secondRecruiterToken}`)
        .send({
          description: 'Updated second recruiter company',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: secondCompanyId,
        description: 'Updated second recruiter company',
      });

      const firstCompany = await prisma.company.findUnique({
        where: {
          id: companyId,
        },
      });

      expect(firstCompany).not.toBeNull();

      expect(firstCompany?.description).toBe('Updated E2E company description');
    });

    it('should persist the second recruiter company assignment', async () => {
      const recruiter = await prisma.recruiter.findUnique({
        where: {
          id: secondRecruiterId,
        },
      });

      expect(recruiter).not.toBeNull();
      expect(recruiter?.companyId).toBe(secondCompanyId);
    });
  });

  afterAll(async () => {
    if (secondRecruiterId) {
      await prisma.recruiter.deleteMany({
        where: {
          id: secondRecruiterId,
        },
      });
    }

    if (recruiterId) {
      await prisma.recruiter.deleteMany({
        where: {
          id: recruiterId,
        },
      });
    }

    if (secondCompanyId) {
      await prisma.company.deleteMany({
        where: {
          id: secondCompanyId,
        },
      });
    }

    if (companyId) {
      await prisma.company.deleteMany({
        where: {
          id: companyId,
        },
      });
    }

    if (candidateUserId) {
      await prisma.user.delete({
        where: {
          id: candidateUserId,
        },
      });
    }

    if (secondRecruiterUserId) {
      await prisma.user.delete({
        where: {
          id: secondRecruiterUserId,
        },
      });
    }

    if (userId) {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    }

    await app.close();
  });
});