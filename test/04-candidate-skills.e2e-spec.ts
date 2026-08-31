import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';

describe('04 - Candidate Skills (e2e)', () => {
    let app: INestApplication;

    let accessToken: string;
    let skillId: string;
    let candidateSkillId: string;

    beforeAll(async () => {
        app = await createTestApp();

        /*
         * Login as Candidate.
         */
        const loginResponse = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                email: 'test2@example.com',
                password: 'Test12345!',
            })
            .expect(201);

        accessToken = loginResponse.body.accessToken;

        expect(accessToken).toEqual(expect.any(String));

        /*
         * Get an existing global Skill.
         *
         * Important:
         * skillId identifies the global Skill resource.
         */
        const skillsResponse = await request(app.getHttpServer())
            .get('/api/v1/skills')
            .expect(200);

        expect(Array.isArray(skillsResponse.body)).toBe(true);
        expect(skillsResponse.body.length).toBeGreaterThan(0);

        skillId = skillsResponse.body[0].id;

        expect(skillId).toEqual(expect.any(String));
    });

    it('should allow a candidate to add a skill', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                skillId,
                proficiencyLevel: 4,
                yearsOfExperience: 3,
            })
            .expect(201);

        expect(response.body).toMatchObject({
            skillId,
            proficiencyLevel: 4,
            yearsOfExperience: '3',
            source: 'SELF_REPORTED',
        });

        /*
         * Important:
         * response.body.id is the CandidateSkill id.
         * It is NOT the global Skill id.
         */
        expect(response.body.id).toEqual(expect.any(String));

        candidateSkillId = response.body.id;
    });

    it('should mark a manually added skill as SELF_REPORTED', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        const candidateSkill = response.body.find(
            (item: { id: string }) => item.id === candidateSkillId,
        );

        expect(candidateSkill).toBeDefined();
        expect(candidateSkill.source).toBe('SELF_REPORTED');
    });

    it('should not allow a candidate to set VERIFIED', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                skillId,
                proficiencyLevel: 4,
                yearsOfExperience: 3,
                source: 'VERIFIED',
            })
            .expect(400);

        expect(response.body.message).toEqual(
            expect.arrayContaining(['property source should not exist']),
        );
    });

    it('should not allow a candidate to set RECRUITER_CONFIRMED', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                skillId,
                proficiencyLevel: 4,
                yearsOfExperience: 3,
                source: 'RECRUITER_CONFIRMED',
            })
            .expect(400);

        expect(response.body.message).toEqual(
            expect.arrayContaining(['property source should not exist']),
        );
    });

    it('should not allow a candidate to set ASSESSMENT', async () => {
        const response = await request(app.getHttpServer())
            .post('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                skillId,
                proficiencyLevel: 4,
                yearsOfExperience: 3,
                source: 'ASSESSMENT',
            })
            .expect(400);

        expect(response.body.message).toEqual(
            expect.arrayContaining(['property source should not exist']),
        );
    });

    it('should not allow a candidate to manipulate provenance on PATCH', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/v1/candidates/me/skills/${candidateSkillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                proficiencyLevel: 5,
                source: 'VERIFIED',
            })
            .expect(400);

        expect(response.body.message).toEqual(
            expect.arrayContaining(['property source should not exist']),
        );

        const listResponse = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        const candidateSkill = listResponse.body.find(
            (item: { id: string }) => item.id === candidateSkillId,
        );

        expect(candidateSkill).toBeDefined();
        expect(candidateSkill.source).toBe('SELF_REPORTED');
    });

    it('should allow a candidate to update proficiency', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/v1/candidates/me/skills/${candidateSkillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                proficiencyLevel: 5,
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: candidateSkillId,
            skillId,
            proficiencyLevel: 5,
            source: 'SELF_REPORTED',
        });
    });

    it('should allow a candidate to update years of experience', async () => {
        const response = await request(app.getHttpServer())
            .patch(`/api/v1/candidates/me/skills/${candidateSkillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                yearsOfExperience: 5,
            })
            .expect(200);

        expect(response.body).toMatchObject({
            id: candidateSkillId,
            skillId,
            yearsOfExperience: '5',
            source: 'SELF_REPORTED',
        });
    });

    it('should allow a candidate to list own skills', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(response.body)).toBe(true);

        const candidateSkill = response.body.find(
            (item: { id: string }) => item.id === candidateSkillId,
        );

        expect(candidateSkill).toBeDefined();
        expect(candidateSkill.skillId).toBe(skillId);
        expect(candidateSkill.source).toBe('SELF_REPORTED');
    });

    it('should allow a candidate to remove their own skill', async () => {
        const response = await request(app.getHttpServer())
            .delete(`/api/v1/candidates/me/skills/${candidateSkillId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body).toEqual({
            message: 'Candidate skill deleted successfully',
        });

        const listResponse = await request(app.getHttpServer())
            .get('/api/v1/candidates/me/skills')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(
            listResponse.body.some(
                (item: { id: string }) => item.id === candidateSkillId,
            ),
        ).toBe(false);
    });

    afterAll(async () => {
        await app.close();
    });


});
