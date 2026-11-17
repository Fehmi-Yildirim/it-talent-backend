import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from './content.service';
import { PrismaService } from '../database/prisma.service';

describe('ContentService', () => {
  let service: ContentService;

  const prismaMock = {
    contentPage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    contentTranslation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  describe('findPublished', () => {
    it('should return a published translation for the requested locale', async () => {
      const publishedPage = {
        locale: 'nl',
        publishedTitle: 'Over ons',
        publishedIntroduction: 'Introductie',
        publishedContent: { type: 'doc', content: [] },
        publishedAt: new Date(),
      };

      prismaMock.contentTranslation.findFirst.mockResolvedValue(publishedPage);

      const result = await service.findPublished('over-ons', 'nl');

      expect(result).toEqual(publishedPage);
      expect(prismaMock.contentTranslation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locale: 'nl',
            isPublished: true,
            page: { slug: 'over-ons' },
          },
        }),
      );
    });

    it('should not return an unpublished or missing translation', async () => {
      prismaMock.contentTranslation.findFirst.mockResolvedValue(null);

      await expect(service.findPublished('over-ons', 'nl')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject unsupported locales', async () => {
      await expect(service.findPublished('over-ons', 'de')).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.contentTranslation.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('saveTranslation', () => {
    it('should save draft content without changing published content', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.upsert.mockResolvedValue({
        id: 'translation-1',
      });

      const draft = {
        draftTitle: 'Nieuwe titel',
        draftContent: { type: 'doc', content: [] },
      };

      await service.saveTranslation('page-1', 'nl', draft, 'user-1');

      expect(prismaMock.contentTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            pageId_locale: {
              pageId: 'page-1',
              locale: 'nl',
            },
          },
          create: {
            ...draft,
            pageId: 'page-1',
            locale: 'nl',
            updatedById: 'user-1',
          },
          update: {
            ...draft,
            updatedById: 'user-1',
          },
        }),
      );

      const upsertCalls: unknown = prismaMock.contentTranslation.upsert.mock.calls;
      const upsertCall = (upsertCalls as [unknown][])[0][0] as {
        update: Record<string, unknown>;
      };

      expect(upsertCall.update).not.toHaveProperty('publishedTitle');
      expect(upsertCall.update).not.toHaveProperty('publishedIntroduction');
      expect(upsertCall.update).not.toHaveProperty('publishedContent');
      expect(upsertCall.update).not.toHaveProperty('isPublished');
      expect(upsertCall.update).not.toHaveProperty('publishedAt');
    });
  });

  describe('publish', () => {
    it('should copy draft fields into the published snapshot', async () => {
      const translation = {
        id: 'translation-1',
        draftTitle: 'Nieuwe titel',
        draftIntroduction: 'Nieuwe introductie',
        draftContent: { type: 'doc', content: [] },
      };

      prismaMock.contentTranslation.findUnique.mockResolvedValue(translation);
      prismaMock.contentTranslation.update.mockResolvedValue({
        ...translation,
        isPublished: true,
      });

      await service.publish('page-1', 'nl');

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          publishedTitle: 'Nieuwe titel',
          publishedIntroduction: 'Nieuwe introductie',
          publishedContent: translation.draftContent,
          isPublished: true,
          publishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('should reject publishing without a title or content', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        draftTitle: null,
        draftContent: null,
      });

      await expect(service.publish('page-1', 'nl')).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('should reject a title containing only whitespace', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        draftTitle: '   ',
        draftContent: { type: 'doc', content: [] },
      });

      await expect(service.publish('page-1', 'nl')).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });
  });

  describe('unpublish', () => {
    it('should set isPublished to false', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        isPublished: false,
      });

      await service.unpublish('page-1', 'nl');

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: { isPublished: false },
      });
    });
  });
});
