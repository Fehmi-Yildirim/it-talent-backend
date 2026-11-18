import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from './content.service';
import { PrismaService } from '../database/prisma.service';

describe('ContentService', () => {
  let service: ContentService;

  const validTiptapContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Dit is een test.',
          },
        ],
      },
    ],
  };

  const txMock = {
    contentPage: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    contentTranslation: {
      create: jest.fn(),
    },
  };

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
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(
      (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    ),
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

  describe('create', () => {
    beforeEach(() => {
      txMock.contentPage.create.mockResolvedValue({
        id: 'page-1',
      });

      txMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-1',
      });

      txMock.contentPage.findUniqueOrThrow.mockResolvedValue({
        id: 'page-1',
        translations: [
          {
            id: 'translation-1',
            locale: 'en',
            slug: 'about-this-app',
            draftTitle: 'About this app',
          },
        ],
      });
    });

    it('should create a page with an English translation', async () => {
      await service.create('About this app', 'en');

      expect(txMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'en',
          slug: 'about-this-app',
          draftTitle: 'About this app',
        },
      });
    });

    it('should create a page with a Dutch translation', async () => {
      await service.create('Over deze app', 'nl');

      expect(txMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'nl',
          slug: 'over-deze-app',
          draftTitle: 'Over deze app',
        },
      });
    });

    it('should reject unsupported locales', async () => {
      await expect(
        service.create('About this app', 'fr'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findPublished', () => {
    it('should return a published translation for the requested locale', async () => {
      const publishedPage = {
        locale: 'nl',
        publishedTitle: 'Over ons',
        publishedIntroduction: 'Introductie',
        publishedContent: validTiptapContent,
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
            slug: 'over-ons',
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
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);
      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-1',
      });

      const draft = {
        draftTitle: 'Nieuwe titel',
        draftContent: validTiptapContent,
      };

      await service.saveTranslation('page-1', 'nl', draft, 'user-1');

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...draft,
            pageId: 'page-1',
            locale: 'nl',
            slug: 'nieuwe-titel',
            draftTitle: 'Nieuwe titel',
            updatedById: 'user-1',
          },
        }),
      );
    });

    it('should create a second locale for the same page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({
        id: 'page-1',
      });

      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-en',
        pageId: 'page-1',
        locale: 'en',
        slug: 'about-this-app',
        draftTitle: 'About this app',
      });

      await service.saveTranslation(
        'page-1',
        'en',
        {
          draftTitle: 'About this app',
          draftContent: validTiptapContent,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'en',
          slug: 'about-this-app',
          draftTitle: 'About this app',
          draftContent: validTiptapContent,
          updatedById: 'user-1',
        },
      });
    });

    it('should reject an empty Tiptap document without saving it', async () => {
      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          {
            draftTitle: 'Lege pagina',
            draftContent: { type: 'doc', content: [] },
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentPage.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('should reject Tiptap content containing only whitespace', async () => {
      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          {
            draftTitle: 'Pagina met witruimte',
            draftContent: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: '   ',
                    },
                  ],
                },
              ],
            },
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('should update an existing translation instead of creating another one', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({
        id: 'page-1',
      });

      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-nl',
        pageId: 'page-1',
        locale: 'nl',
      });

      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-nl',
        draftTitle: 'Nieuwe Nederlandse titel',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        { draftTitle: 'Nieuwe Nederlandse titel' },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-nl' },
        data: {
          draftTitle: 'Nieuwe Nederlandse titel',
          updatedById: 'user-1',
        },
      });

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('should reject creating a translation without a title', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({
        id: 'page-1',
      });

      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.saveTranslation('page-1', 'en', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('should reject saving a translation for a non-existing page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue(null);

      await expect(
        service.saveTranslation(
          'unknown-page',
          'en',
          { draftTitle: 'About this app' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.contentTranslation.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('should update a translation created concurrently', async () => {
      const concurrentTranslation = {
        id: 'translation-en',
        pageId: 'page-1',
        locale: 'en',
      };

      prismaMock.contentPage.findUnique.mockResolvedValue({
        id: 'page-1',
      });

      prismaMock.contentTranslation.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(concurrentTranslation);

      prismaMock.contentTranslation.create.mockRejectedValue({
        code: 'P2002',
      });

      prismaMock.contentTranslation.update.mockResolvedValue({
        ...concurrentTranslation,
        draftTitle: 'About this app',
      });

      await service.saveTranslation(
        'page-1',
        'en',
        { draftTitle: 'About this app' },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-en' },
        data: {
          draftTitle: 'About this app',
          updatedById: 'user-1',
        },
      });
    });
  });

  describe('publish', () => {
    it('should copy draft fields into the published snapshot', async () => {
      const translation = {
        id: 'translation-1',
        draftTitle: 'Nieuwe titel',
        draftIntroduction: 'Nieuwe introductie',
        draftContent: validTiptapContent,
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

    it('should reject publishing an empty Tiptap document', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        draftTitle: 'Lege pagina',
        draftContent: { type: 'doc', content: [] },
      });

      await expect(service.publish('page-1', 'nl')).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('should reject publishing a title containing only whitespace', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        draftTitle: '   ',
        draftContent: validTiptapContent,
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
