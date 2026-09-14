import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

interface LoginResponse {
  accessToken: string;
  user: {
    email: string;
    role: string;
    status: string;
  };
}

interface SkillResponse {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
}

describe('02 - Skills (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let candidateAccessToken: string;
  let adminAccessToken: string;

  let skillId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const candidateLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'candidate@example.com',
        password: 'Candidate12345!',
      })
      .expect(201);

    const candidateBody = candidateLogin.body as LoginResponse;
    candidateAccessToken = candidateBody.accessToken;

    expect(candidateAccessToken).toEqual(expect.any(String));

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin12345!',
      })
      .expect(201);

    const adminBody = adminLogin.body as LoginResponse;
    adminAccessToken = adminBody.accessToken;

    expect(adminAccessToken).toEqual(expect.any(String));

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/skills')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        name: 'E2E Test Skill',
        category: 'BACKEND',
        description: 'Skill created for E2E tests',
      });

    if (createResponse.status !== 201) {
      throw new Error(
        [
          'E2E skill setup failed.',
          'Expected: 201',
          `Received: ${createResponse.status}`,
          `Response: ${JSON.stringify(createResponse.body)}`,
        ].join('\n'),
      );
    }

    const createdSkill = createResponse.body as SkillResponse;
    skillId = createdSkill.id;
    expect(createdSkill.slug).toBe('e2e-test-skill');
    expect(skillId).toEqual(expect.any(String));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/skills', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/skills').expect(401);
    });

    it('should allow authenticated users to list skills', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/skills')
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(200);

      const skills = response.body as SkillResponse[];

      expect(Array.isArray(skills)).toBe(true);
    });

    it('should support search filtering', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/skills')
        .query({
          search: 'E2E Test Skill',
        })
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(200);

      const skills = response.body as SkillResponse[];

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.some((skill) => skill.id === skillId)).toBe(true);
    });

    it('should reject an invalid category filter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/skills')
        .query({
          category: 'INVALID_CATEGORY',
        })
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(400);
    });
  });

  describe('POST /api/v1/skills', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .send({
          name: 'Unauthorized Skill',
          category: 'BACKEND',
          description: 'Should not be created',
        })
        .expect(401);
    });

    it('should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .send({
          name: 'Candidate Skill',
          category: 'BACKEND',
          description: 'Candidate must not create skills',
        })
        .expect(403);
    });

    it('should reject an invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: '',
          slug: '',
          category: 'INVALID_CATEGORY',
        })
        .expect(400);
    });

    it('should allow ADMIN to create a skill', async () => {
      const skillName = `Created By Admin ${Date.now()}`;
      const expectedSlug = skillName.toLowerCase().replace(/\s+/g, '-');

      const response = await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: skillName,
          category: 'BACKEND',
          description: 'Created by E2E admin test',
        })
        .expect(201);

      const createdSkill = response.body as SkillResponse;

      expect(createdSkill).toMatchObject({
        name: skillName,
        slug: expectedSlug,
        category: 'BACKEND',
      });

      expect(createdSkill.id).toEqual(expect.any(String));
    });

    it('should reject a skill when the generated slug already exists', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'E2E Test Skill',
          category: 'BACKEND',
          description: 'Duplicate generated slug',
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/skills/:id', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/skills/${skillId}`)
        .expect(401);
    });

    it('should allow authenticated users to get a skill', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(200);

      const skill = response.body as SkillResponse;

      expect(skill).toMatchObject({
        id: skillId,
        name: 'E2E Test Skill',
        slug: 'e2e-test-skill',
        category: 'BACKEND',
      });
    });

    it('should return 404 for a non-existing skill', async () => {
      const nonExistingSkillId =
        '00000000-0000-4000-8000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/v1/skills/${nonExistingSkillId}`)
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/skills/:id', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/skills/${skillId}`)
        .send({
          description: 'Unauthorized update',
        })
        .expect(401);
    });

    it('should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .send({
          description: 'Candidate update',
        })
        .expect(403);
    });

    it('should allow ADMIN to update a skill', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          description: 'Updated E2E description',
        })
        .expect(200);

      const updatedSkill = response.body as SkillResponse;

      expect(updatedSkill).toMatchObject({
        id: skillId,
        description: 'Updated E2E description',
      });
    });

    it('should reject an invalid update payload', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          category: 'INVALID_CATEGORY',
        })
        .expect(400);
    });

    it('should return 404 when updating a non-existing skill', async () => {
      const nonExistingSkillId =
        '00000000-0000-4000-8000-000000000001';

      await request(app.getHttpServer())
        .patch(`/api/v1/skills/${nonExistingSkillId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          description: 'Should not exist',
        })
        .expect(404);
    });

    it('should regenerate the slug when the name changes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Updated React Native Skill',
        })
        .expect(200);

      const updatedSkill = response.body as SkillResponse;

      expect(updatedSkill).toMatchObject({
        id: skillId,
        name: 'Updated React Native Skill',
        slug: 'updated-react-native-skill',
      });
    });
  });

  describe('DELETE /api/v1/skills/:id', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/skills/${skillId}`)
        .expect(401);
    });

    it('should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(403);
    });

    it('should reject deletion when a skill is still in use', async () => {
      const candidate = await prisma.candidate.findFirst({
        where: {
          user: {
            email: 'candidate@example.com',
          },
        },
      });

      expect(candidate).not.toBeNull();

      if (!candidate) {
        throw new Error('E2E candidate setup failed.');
      }

      const candidateSkill = await prisma.candidateSkill.create({
        data: {
          candidateId: candidate.id,
          skillId,
          proficiencyLevel: 3,
          source: 'SELF_REPORTED',
        },
      });

      try {
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/skills/${skillId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(409);

        expect(response.body).toEqual(
          expect.objectContaining({
            message: 'Skill cannot be deleted because it is still in use.',
          }),
        );

        await request(app.getHttpServer())
          .get(`/api/v1/skills/${skillId}`)
          .set('Authorization', `Bearer ${candidateAccessToken}`)
          .expect(200);
      } finally {
        await prisma.candidateSkill.delete({
          where: {
            id: candidateSkill.id,
          },
        });
      }
    });

    it('should allow ADMIN to delete a skill', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
    });

    it('should return 404 after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/skills/${skillId}`)
        .set('Authorization', `Bearer ${candidateAccessToken}`)
        .expect(404);
    });
  });
});
