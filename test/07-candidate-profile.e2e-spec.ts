/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import * as argon2 from 'argon2';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

describe('07 - Candidate Profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let candidateToken: string;
  let candidateUserId: string;
  let candidateId: string;

  let recruiterToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    /*
     * Create isolated Candidate user.
     */
    const candidateEmail = `e2e-candidate-profile-${Date.now()}@example.com`;
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

    /*
     * Login Candidate.
     */
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
     * Create Recruiter user for authorization tests.
     */
    const recruiterEmail = `e2e-candidate-profile-recruiter-${Date.now()}@example.com`;
    const recruiterPassword = 'Recruiter12345!';

    const recruiterPasswordHash = await argon2.hash(recruiterPassword);

    await prisma.user.create({
      data: {
        email: recruiterEmail,
        passwordHash: recruiterPasswordHash,
        firstName: 'Test',
        lastName: 'Recruiter',
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

  it('should reject unauthenticated access to candidate profile', async () => {
    await request(app.getHttpServer()).get('/api/v1/candidates/me').expect(401);
  });

  it('should reject unauthenticated candidate creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .send({
        headline: 'Unauthenticated Candidate',
      })
      .expect(401);
  });

  it('should reject non-CANDIDATE users', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(403);
  });

  it('should reject client-provided userId', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        userId: 'some-other-user-id',
        headline: 'Should be rejected',
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining(['property userId should not exist']),
    );
  });

  it('should create a candidate profile for the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        headline: 'Full Stack Developer',
        summary: 'Candidate created through canonical API',
        location: 'Rotterdam',
        salaryMin: 4500,
        salaryMax: 6000,
        currency: 'EUR',
        availabilityDate: '2026-10-01T00:00:00.000Z',
        remotePreference: 'HYBRID',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      headline: 'Full Stack Developer',
      summary: 'Candidate created through canonical API',
      location: 'Rotterdam',
      currency: 'EUR',
      remotePreference: 'HYBRID',
    });

    /*
     * Prisma Decimal values may be serialized as strings.
     */
    expect(Number(response.body.salaryMin)).toBe(4500);
    expect(Number(response.body.salaryMax)).toBe(6000);

    expect(response.body.id).toEqual(expect.any(String));

    /*
     * Store the candidate ID immediately after creation.
     */
    candidateId = response.body.id;

    /*
     * Important ownership assertion:
     * the Candidate must belong to the authenticated user.
     */
    const candidate = await prisma.candidate.findUnique({
      where: {
        id: candidateId,
      },
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.userId).toBe(candidateUserId);
  });

  it('should retrieve the authenticated user candidate profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: candidateId,
      userId: candidateUserId,
      headline: 'Full Stack Developer',
      location: 'Rotterdam',
    });

    expect(response.body.id).toEqual(expect.any(String));
  });

  it('should update only the authenticated user candidate profile', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        headline: 'Senior Full Stack Developer',
        location: 'Amsterdam',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: candidateId,
      userId: candidateUserId,
      headline: 'Senior Full Stack Developer',
      location: 'Amsterdam',
    });

    const candidate = await prisma.candidate.findUnique({
      where: {
        id: candidateId,
      },
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.userId).toBe(candidateUserId);
    expect(candidate?.headline).toBe('Senior Full Stack Developer');
  });

  it('should reject client-provided userId on PATCH', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        userId: 'some-other-user-id',
        headline: 'Should not be accepted',
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining(['property userId should not exist']),
    );

    const candidate = await prisma.candidate.findUnique({
      where: {
        id: candidateId,
      },
    });

    expect(candidate?.userId).toBe(candidateUserId);
    expect(candidate?.headline).toBe('Senior Full Stack Developer');
  });

  it('should reject duplicate candidate profile creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/candidates')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        headline: 'Duplicate Candidate',
      })
      .expect(409);
  });

  afterAll(async () => {
    /*
     * Delete all Candidate profiles belonging to this e2e test run first.
     * The broad email prefix also catches stale test users from a previous
     * failed run, preventing foreign-key errors during cleanup.
     */
    await prisma.candidate.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'e2e-candidate-profile-',
          },
        },
      },
    });

    /*
     * Delete all Candidate/Recruiter test users after their profiles
     * have been removed.
     */
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'e2e-candidate-profile-',
        },
      },
    });

    await app.close();
  });
});