import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentStatus } from '../../generated/prisma/enums';
import { ContentService } from './content.service';
import { PrismaService } from '../database/prisma.service';

describe('ContentService', () => {
  let service: ContentService;

  const validTiptapContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Dit is een test.' }],
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
      txMock.contentPage.create.mockResolvedValue({ id: 'page-1' });
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
            title: 'About this app',
            status: ContentStatus.DRAFT,
          },
        ],
      });
    });

    it('creates a page with an English draft translation', async () => {
      await service.create('About this app', 'en', validTiptapContent);

      expect(txMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'en',
          slug: 'about-this-app',
          title: 'About this app',
          content: validTiptapContent,
          status: ContentStatus.DRAFT,
        },
      });
    });

    it('creates a page with a Dutch draft translation', async () => {
      await service.create('Over deze app', 'nl', validTiptapContent);

      expect(txMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'nl',
          slug: 'over-deze-app',
          title: 'Over deze app',
          content: validTiptapContent,
          status: ContentStatus.DRAFT,
        },
      });
    });

    it('rejects unsupported locales', async () => {
      await expect(
        service.create('About this app', 'fr', validTiptapContent),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an empty Tiptap document', async () => {
      await expect(
        service.create('Empty page', 'en', {
          type: 'doc',
          content: [],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(txMock.contentPage.create).not.toHaveBeenCalled();
    });

    it('rejects Tiptap content containing only whitespace', async () => {
      await expect(
        service.create('Whitespace page', 'en', {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '   ' }],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('propagates a database error', async () => {
      txMock.contentTranslation.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.create('About this app', 'en', validTiptapContent),
      ).rejects.toThrow('Database error');
    });
  });

  describe('findPublished', () => {
    it('returns a published translation and its published language alternatives', async () => {
      const publishedAt = new Date();
      const publishedPage = {
        slug: 'over-ons',
        locale: 'nl',
        title: 'Over ons',
        content: validTiptapContent,
        publishedAt,
        page: {
          translations: [
            { locale: 'en', slug: 'about-us' },
            { locale: 'nl', slug: 'over-ons' },
          ],
        },
      };

      prismaMock.contentTranslation.findFirst.mockResolvedValue(publishedPage);

      const result = await service.findPublished('over-ons', 'nl');

      expect(result).toEqual({
        slug: 'over-ons',
        locale: 'nl',
        title: 'Over ons',
        content: validTiptapContent,
        publishedAt,
        translations: [
          { locale: 'en', slug: 'about-us' },
          { locale: 'nl', slug: 'over-ons' },
        ],
      });

      expect(prismaMock.contentTranslation.findFirst).toHaveBeenCalledWith({
        where: {
          locale: 'nl',
          slug: 'over-ons',
          status: ContentStatus.PUBLISHED,
        },
        select: {
          slug: true,
          locale: true,
          title: true,
          content: true,
          publishedAt: true,
          page: {
            select: {
              translations: {
                where: { status: ContentStatus.PUBLISHED },
                orderBy: { locale: 'asc' },
                select: {
                  locale: true,
                  slug: true,
                },
              },
            },
          },
        },
      });
    });

    it('does not return a missing or non-published translation', async () => {
      prismaMock.contentTranslation.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublished('over-ons', 'nl'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects unsupported locales', async () => {
      await expect(
        service.findPublished('over-ons', 'de'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('saveTranslation', () => {
    it('creates a translation with DRAFT status and no publication date by default', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);
      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-1',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        {
          title: 'Nieuwe titel',
          content: validTiptapContent,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'nl',
          slug: 'nieuwe-titel',
          title: 'Nieuwe titel',
          content: validTiptapContent,
          status: ContentStatus.DRAFT,
          publishedAt: null,
          updatedById: 'user-1',
        },
      });
    });

    it('creates a translation with the requested status', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);
      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-1',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        {
          title: 'Nieuwe titel',
          content: validTiptapContent,
          status: ContentStatus.PRIVATE,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'nl',
          slug: 'nieuwe-titel',
          title: 'Nieuwe titel',
          content: validTiptapContent,
          status: ContentStatus.PRIVATE,
          publishedAt: null,
          updatedById: 'user-1',
        },
      });
    });

    it('creates a published translation and records publishedAt', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);
      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-1',
      });

      await service.saveTranslation(
        'page-1',
        'en',
        {
          title: 'About this app',
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'en',
          slug: 'about-this-app',
          title: 'About this app',
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
          publishedAt: expect.any(Date) as Date,
          updatedById: 'user-1',
        },
      });
    });

    it('creates another locale for the same page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);
      prismaMock.contentTranslation.create.mockResolvedValue({
        id: 'translation-en',
      });

      await service.saveTranslation(
        'page-1',
        'en',
        {
          title: 'About this app',
          content: validTiptapContent,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.create).toHaveBeenCalledWith({
        data: {
          pageId: 'page-1',
          locale: 'en',
          slug: 'about-this-app',
          title: 'About this app',
          content: validTiptapContent,
          status: ContentStatus.DRAFT,
          publishedAt: null,
          updatedById: 'user-1',
        },
      });
    });

    it('updates content and status together when publishing an existing translation', async () => {
      const previousPublishedAt = new Date('2026-01-01T10:00:00.000Z');

      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        pageId: 'page-1',
        locale: 'nl',
        slug: 'oude-titel',
        title: 'Oude titel',
        content: validTiptapContent,
        status: ContentStatus.DRAFT,
        publishedAt: null,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status: ContentStatus.PUBLISHED,
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        {
          title: 'Nieuwe titel',
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          title: 'Nieuwe titel',
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
          publishedAt: expect.any(Date) as Date,
          slug: 'nieuwe-titel',
          updatedById: 'user-1',
        },
      });

      expect(previousPublishedAt).toBeInstanceOf(Date);
      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('preserves the existing status and publication date when status is omitted', async () => {
      const publishedAt = new Date('2026-01-01T10:00:00.000Z');

      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        pageId: 'page-1',
        locale: 'nl',
        slug: 'oude-titel',
        title: 'Oude titel',
        content: validTiptapContent,
        status: ContentStatus.PUBLISHED,
        publishedAt,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        { title: 'Nieuwe titel' },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          title: 'Nieuwe titel',
          status: ContentStatus.PUBLISHED,
          publishedAt,
          slug: 'nieuwe-titel',
          updatedById: 'user-1',
        },
      });
    });

    it('preserves the original publication date when editing an already published translation', async () => {
      const publishedAt = new Date('2026-01-01T10:00:00.000Z');

      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        pageId: 'page-1',
        locale: 'nl',
        slug: 'over-ons',
        title: 'Over ons',
        content: validTiptapContent,
        status: ContentStatus.PUBLISHED,
        publishedAt,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        {
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
        },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          content: validTiptapContent,
          status: ContentStatus.PUBLISHED,
          publishedAt,
          slug: 'over-ons',
          updatedById: 'user-1',
        },
      });
    });

    it('changes an existing translation to DRAFT in the same update', async () => {
      const publishedAt = new Date('2026-01-01T10:00:00.000Z');

      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        pageId: 'page-1',
        locale: 'nl',
        slug: 'over-ons',
        title: 'Over ons',
        content: validTiptapContent,
        status: ContentStatus.PUBLISHED,
        publishedAt,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status: ContentStatus.DRAFT,
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        { status: ContentStatus.DRAFT },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          status: ContentStatus.DRAFT,
          publishedAt,
          slug: 'over-ons',
          updatedById: 'user-1',
        },
      });
    });

    it('rejects publishing an existing translation without meaningful content', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        pageId: 'page-1',
        locale: 'nl',
        slug: 'over-ons',
        title: 'Over ons',
        content: { type: 'doc', content: [] },
        status: ContentStatus.DRAFT,
      });

      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          { status: ContentStatus.PUBLISHED },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('rejects publishing a new translation without meaningful content', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          {
            title: 'Nieuwe pagina',
            status: ContentStatus.PUBLISHED,
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('rejects an empty Tiptap document', async () => {
      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          {
            title: 'Lege pagina',
            content: { type: 'doc', content: [] },
          },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentPage.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('rejects Tiptap content containing only whitespace', async () => {
      await expect(
        service.saveTranslation(
          'page-1',
          'nl',
          {
            title: 'Pagina met witruimte',
            content: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '   ' }],
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

    it('updates an existing translation and regenerates its slug when the title changes', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique
        .mockResolvedValueOnce({
          id: 'translation-nl',
          pageId: 'page-1',
          locale: 'nl',
          slug: 'oude-titel',
          title: 'Oude titel',
          content: validTiptapContent,
          status: ContentStatus.DRAFT,
          publishedAt: null,
        })
        .mockResolvedValueOnce(null);

      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-nl',
      });

      await service.saveTranslation(
        'page-1',
        'nl',
        { title: 'Nieuwe Nederlandse titel' },
        'user-1',
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-nl' },
        data: {
          title: 'Nieuwe Nederlandse titel',
          status: ContentStatus.DRAFT,
          publishedAt: null,
          slug: 'nieuwe-nederlandse-titel',
          updatedById: 'user-1',
        },
      });

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('rejects creating a translation without a title', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({ id: 'page-1' });
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.saveTranslation('page-1', 'en', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });

    it('rejects saving a translation for a non-existing page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue(null);

      await expect(
        service.saveTranslation(
          'unknown-page',
          'en',
          { title: 'About this app' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.contentTranslation.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.contentTranslation.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it.each([
      ContentStatus.DRAFT,
      ContentStatus.PRIVATE,
      ContentStatus.ARCHIVED,
    ])('changes a translation status to %s', async (status) => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: 'Over ons',
        content: validTiptapContent,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status,
      });

      await service.updateStatus('page-1', 'nl', status);

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: { status },
      });
    });

    it('publishes a translation and records publishedAt', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: 'Over ons',
        content: validTiptapContent,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status: ContentStatus.PUBLISHED,
      });

      await service.updateStatus(
        'page-1',
        'nl',
        ContentStatus.PUBLISHED,
      );

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: expect.any(Date) as Date,
        },
      });
    });

    it('rejects publishing without a title or content', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: null,
        content: null,
      });

      await expect(
        service.updateStatus(
          'page-1',
          'nl',
          ContentStatus.PUBLISHED,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('rejects publishing an empty Tiptap document', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: 'Lege pagina',
        content: { type: 'doc', content: [] },
      });

      await expect(
        service.updateStatus(
          'page-1',
          'nl',
          ContentStatus.PUBLISHED,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('rejects publishing a whitespace-only title', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: '   ',
        content: validTiptapContent,
      });

      await expect(
        service.updateStatus(
          'page-1',
          'nl',
          ContentStatus.PUBLISHED,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('rejects changing the status of a missing translation', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'page-1',
          'nl',
          ContentStatus.PRIVATE,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.contentTranslation.update).not.toHaveBeenCalled();
    });

    it('rejects unsupported locales', async () => {
      await expect(
        service.updateStatus(
          'page-1',
          'de',
          ContentStatus.PRIVATE,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.contentTranslation.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('sets the status to PUBLISHED', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
        title: 'Nieuwe titel',
        content: validTiptapContent,
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status: ContentStatus.PUBLISHED,
      });

      await service.publish('page-1', 'nl');

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: {
          status: ContentStatus.PUBLISHED,
          publishedAt: expect.any(Date) as Date,
        },
      });
    });
  });

  describe('unpublish', () => {
    it('returns the translation to DRAFT', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
      });
      prismaMock.contentTranslation.update.mockResolvedValue({
        id: 'translation-1',
        status: ContentStatus.DRAFT,
      });

      await service.unpublish('page-1', 'nl');

      expect(prismaMock.contentTranslation.update).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
        data: { status: ContentStatus.DRAFT },
      });
    });
  });

  describe('removeTranslation', () => {
    it('deletes an existing translation', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({
        id: 'translation-1',
      });
      prismaMock.contentTranslation.delete.mockResolvedValue({
        id: 'translation-1',
      });

      await service.removeTranslation('page-1', 'nl');

      expect(prismaMock.contentTranslation.delete).toHaveBeenCalledWith({
        where: { id: 'translation-1' },
      });
    });

    it('rejects deleting a missing translation', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.removeTranslation('page-1', 'nl'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePage', () => {
    it('deletes an existing page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue({
        id: 'page-1',
      });
      prismaMock.contentPage.delete.mockResolvedValue({
        id: 'page-1',
      });

      await service.removePage('page-1');

      expect(prismaMock.contentPage.delete).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });

    it('rejects deleting a missing page', async () => {
      prismaMock.contentPage.findUnique.mockResolvedValue(null);

      await expect(service.removePage('unknown-page')).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.contentPage.delete).not.toHaveBeenCalled();
    });
  });
});
