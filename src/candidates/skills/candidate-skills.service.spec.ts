import { Test, TestingModule } from '@nestjs/testing';
import { CandidateSkillsService } from './candidate-skills.service';
import { PrismaService } from '../../database/prisma.service';
import { MatchingService } from '../../matching/matching.service';

describe('CandidateSkillsService', () => {
    let service: CandidateSkillsService;

    const prismaMock = {
        user: {
            findUnique: jest.fn(),
        },
        candidate: {
            findUnique: jest.fn(),
        },
        skill: {
            findUnique: jest.fn(),
        },
        candidateSkill: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };

    const matchingServiceMock = {
        recalculateCandidate: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CandidateSkillsService,
                {
                    provide: PrismaService,
                    useValue: prismaMock,
                },
                {
                    provide: MatchingService,
                    useValue: matchingServiceMock,
                },
            ],
        }).compile();

        service = module.get<CandidateSkillsService>(CandidateSkillsService);
    });

    describe('matching recalculation', () => {
        it('should recalculate candidate matching after creating a skill', async () => {
            // Arrange
            const userId = 'user-1';
            const candidateId = 'candidate-1';

            prismaMock.user.findUnique.mockResolvedValue({
                id: userId,
                role: 'CANDIDATE',
            });

            prismaMock.candidate.findUnique.mockResolvedValue({
                id: candidateId,
                userId,
            });

            prismaMock.skill.findUnique.mockResolvedValue({
                id: 'skill-1',
            });

            prismaMock.candidateSkill.findFirst.mockResolvedValue(null);

            prismaMock.candidateSkill.create.mockResolvedValue({
                id: 'candidate-skill-1',
                candidateId,
                skillId: 'skill-1',
            });

            // Act
            await service.create(userId, {
                skillId: 'skill-1',
                proficiencyLevel: 3,
                yearsOfExperience: 2,
            });

            // Assert
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledTimes(1);
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledWith(
                candidateId,
            );
        });

        it('should recalculate candidate matching after updating a skill', async () => {
            // Arrange
            const userId = 'user-1';
            const candidateId = 'candidate-1';
            const candidateSkillId = 'candidate-skill-1';

            prismaMock.candidate.findUnique.mockResolvedValue({
                id: candidateId,
                userId,
            });

            prismaMock.candidateSkill.findFirst.mockResolvedValue({
                id: candidateSkillId,
                candidateId,
            });

            prismaMock.candidateSkill.update.mockResolvedValue({
                id: candidateSkillId,
                candidateId,
            });

            // Act
            await service.updateMine(userId, candidateSkillId, {
                proficiencyLevel: 4,
            });

            // Assert
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledTimes(1);
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledWith(
                candidateId,
            );
        });

        it('should recalculate candidate matching after removing a skill', async () => {
            // Arrange
            const userId = 'user-1';
            const candidateId = 'candidate-1';
            const candidateSkillId = 'candidate-skill-1';

            prismaMock.candidate.findUnique.mockResolvedValue({
                id: candidateId,
                userId,
            });

            prismaMock.candidateSkill.findFirst.mockResolvedValue({
                id: candidateSkillId,
                candidateId,
            });

            prismaMock.candidateSkill.delete.mockResolvedValue({
                id: candidateSkillId,
            });

            // Act
            await service.removeMine(userId, candidateSkillId);

            // Assert
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledTimes(1);
            expect(matchingServiceMock.recalculateCandidate).toHaveBeenCalledWith(
                candidateId,
            );
        });

        it('should not recalculate matching when creating a skill fails', async () => {
            const userId = 'user-1';
            const candidateId = 'candidate-1';

            prismaMock.user.findUnique.mockResolvedValue({
                id: userId,
                role: 'CANDIDATE',
            });

            prismaMock.candidate.findUnique.mockResolvedValue({
                id: candidateId,
                userId,
            });

            prismaMock.skill.findUnique.mockResolvedValue({
                id: 'skill-1',
            });

            prismaMock.candidateSkill.findFirst.mockResolvedValue(null);

            prismaMock.candidateSkill.create.mockRejectedValue(
                new Error('Database error'),
            );

            await expect(
                service.create(userId, {
                    skillId: 'skill-1',
                    proficiencyLevel: 3,
                    yearsOfExperience: 2,
                }),
            ).rejects.toThrow('Database error');

            expect(matchingServiceMock.recalculateCandidate).not.toHaveBeenCalled();
        });

        it('should not recalculate matching when updating a skill fails', async () => {
            const userId = 'user-1';
            const candidateId = 'candidate-1';
            const candidateSkillId = 'candidate-skill-1';

            prismaMock.candidate.findUnique.mockResolvedValue({
                id: candidateId,
                userId,
            });

            prismaMock.candidateSkill.findFirst.mockResolvedValue({
                id: candidateSkillId,
                candidateId,
            });

            // Simulate a database error
            prismaMock.candidateSkill.update.mockRejectedValue(
                new Error('Database error'),
            );

            await expect(
                service.updateMine(userId, candidateSkillId, {
                    proficiencyLevel: 4,
                }),
            ).rejects.toThrow('Database error');

            expect(matchingServiceMock.recalculateCandidate).not.toHaveBeenCalled();
        });

    });
});
