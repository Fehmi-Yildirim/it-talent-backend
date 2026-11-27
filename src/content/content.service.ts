import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

function containsMeaningfulText(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as {
    type?: string;
    text?: string;
    content?: unknown[];
  };

  if (node.type === 'text') {
    return typeof node.text === 'string' && node.text.trim().length > 0;
  }

  if (!Array.isArray(node.content)) {
    return false;
  }

  return node.content.some(containsMeaningfulText);
}

function hasMeaningfulTiptapContent(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const document = value as {
    type?: string;
    content?: unknown[];
  };

  if (document.type !== 'doc' || !Array.isArray(document.content)) {
    return false;
  }

  return document.content.some(containsMeaningfulText);
}

const SUPPORTED_LOCALES = ['nl', 'en'] as const;
const MAX_SLUG_ATTEMPTS = 20;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) { }

  private validateLocale(locale: string): void {
    if (
      !SUPPORTED_LOCALES.includes(
        locale as (typeof SUPPORTED_LOCALES)[number],
      )
    ) {
      throw new BadRequestException('Unsupported locale');
    }
  }

  private slugify(value: string): string {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100)
      .replace(/-+$/g, '');

    if (!slug) {
      throw new BadRequestException(
        'The title must contain at least one letter or number',
      );
    }

    return slug;
  }

  private slugCandidate(base: string, attempt: number): string {
    if (attempt === 0) {
      return base;
    }

    const suffix = `-${attempt + 1}`;
    return `${base.slice(0, 100 - suffix.length)}${suffix}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async findPublished(slug: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findFirst({
      where: {
        locale,
        slug,
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
              where: {
                status: ContentStatus.PUBLISHED,
              },
              orderBy: {
                locale: 'asc',
              },
              select: {
                locale: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!translation) {
      throw new NotFoundException('Published page not found');
    }

    const { page, ...publishedPage } = translation;

    return {
      ...publishedPage,
      translations: page.translations,
    };
  }

  async findAll() {
    return this.prisma.contentPage.findMany({
      include: {
        translations: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const page = await this.prisma.contentPage.findUnique({
      where: { id },
      include: {
        translations: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Content page not found');
    }

    return page;
  }

  async create(
    title: string,
    locale: string,
    content: Prisma.InputJsonValue,
  ) {
    this.validateLocale(locale);

    if (!hasMeaningfulTiptapContent(content)) {
      throw new BadRequestException('Page content cannot be empty');
    }

    const normalizedTitle = title.trim();
    const baseSlug = this.slugify(normalizedTitle);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = this.slugCandidate(baseSlug, attempt);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const page = await tx.contentPage.create({
            data: {},
          });

          await tx.contentTranslation.create({
            data: {
              pageId: page.id,
              locale,
              slug,
              title: normalizedTitle,
              content,
              status: ContentStatus.DRAFT,
            },
          });

          return tx.contentPage.findUniqueOrThrow({
            where: { id: page.id },
            include: {
              translations: true,
            },
          });
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException(
      'Could not generate a unique slug for this title',
    );
  }

  async saveTranslation(
    pageId: string,
    locale: string,
    data: {
      title?: string;
      content?: Prisma.InputJsonValue;
      status?: ContentStatus;
    },
    userId: string,
  ): Promise<Prisma.ContentTranslationGetPayload<Record<string, never>>> {
    this.validateLocale(locale);

    if (
      data.content !== undefined &&
      !hasMeaningfulTiptapContent(data.content)
    ) {
      throw new BadRequestException(
        'Content must contain meaningful text',
      );
    }

    await this.findOne(pageId);

    const existing = await this.prisma.contentTranslation.findUnique({
      where: {
        pageId_locale: { pageId, locale },
      },
    });

    if (existing) {
      const normalizedTitle =
        data.title !== undefined ? data.title.trim() : undefined;

      const nextTitle = normalizedTitle ?? existing.title;
      const nextContent = data.content ?? existing.content;
      const nextStatus = data.status ?? existing.status;

      if (nextStatus === ContentStatus.PUBLISHED) {
        if (
          typeof nextTitle !== 'string' ||
          nextTitle.trim().length === 0 ||
          !hasMeaningfulTiptapContent(nextContent)
        ) {
          throw new BadRequestException(
            'Translation requires a title and meaningful content',
          );
        }
      }

      let slug = existing.slug;

      if (
        normalizedTitle !== undefined &&
        normalizedTitle !== existing.title
      ) {
        const baseSlug = this.slugify(normalizedTitle);
        let foundUniqueSlug = false;

        for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
          const candidate = this.slugCandidate(baseSlug, attempt);

          const conflictingTranslation =
            await this.prisma.contentTranslation.findUnique({
              where: {
                locale_slug: {
                  locale,
                  slug: candidate,
                },
              },
            });

          if (
            !conflictingTranslation ||
            conflictingTranslation.id === existing.id
          ) {
            slug = candidate;
            foundUniqueSlug = true;
            break;
          }
        }

        if (!foundUniqueSlug) {
          throw new BadRequestException(
            'Could not generate a unique slug for this translation',
          );
        }
      }

      const publishedAt =
        nextStatus === ContentStatus.PUBLISHED
          ? existing.status === ContentStatus.PUBLISHED
            ? existing.publishedAt ?? new Date()
            : new Date()
          : existing.publishedAt;

      return this.prisma.contentTranslation.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(normalizedTitle !== undefined
            ? { title: normalizedTitle }
            : {}),
          status: nextStatus,
          publishedAt,
          slug,
          updatedById: userId,
        },
      });
    }

    if (!data.title?.trim()) {
      throw new BadRequestException(
        'A title is required to create a translation',
      );
    }

    const normalizedTitle = data.title.trim();
    const nextStatus = data.status ?? ContentStatus.DRAFT;

    if (
      nextStatus === ContentStatus.PUBLISHED &&
      !hasMeaningfulTiptapContent(data.content)
    ) {
      throw new BadRequestException(
        'Translation requires a title and meaningful content',
      );
    }

    const baseSlug = this.slugify(normalizedTitle);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = this.slugCandidate(baseSlug, attempt);

      try {
        return await this.prisma.contentTranslation.create({
          data: {
            pageId,
            locale,
            slug,
            ...data,
            title: normalizedTitle,
            status: nextStatus,
            publishedAt:
              nextStatus === ContentStatus.PUBLISHED ? new Date() : null,
            updatedById: userId,
          },
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        const concurrentlyCreated =
          await this.prisma.contentTranslation.findUnique({
            where: {
              pageId_locale: { pageId, locale },
            },
          });

        if (concurrentlyCreated) {
          return this.saveTranslation(pageId, locale, data, userId);
        }
      }
    }

    throw new BadRequestException(
      'Could not generate a unique slug for this translation',
    );
  }

  async updateStatus(
    pageId: string,
    locale: string,
    status: ContentStatus,
  ) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findUnique({
      where: {
        pageId_locale: { pageId, locale },
      },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    if (status === ContentStatus.PUBLISHED) {
      if (
        typeof translation.title !== 'string' ||
        translation.title.trim().length === 0 ||
        !hasMeaningfulTiptapContent(translation.content)
      ) {
        throw new BadRequestException(
          'Translation requires a title and meaningful content',
        );
      }
    }

    return this.prisma.contentTranslation.update({
      where: { id: translation.id },
      data: {
        status,
        ...(status === ContentStatus.PUBLISHED
          ? {
            publishedAt:
              translation.status === ContentStatus.PUBLISHED
                ? translation.publishedAt ?? new Date()
                : new Date(),
          }
          : {}),
      },
    });
  }

  async publish(pageId: string, locale: string) {
    return this.updateStatus(pageId, locale, ContentStatus.PUBLISHED);
  }

  async unpublish(pageId: string, locale: string) {
    return this.updateStatus(pageId, locale, ContentStatus.DRAFT);
  }

  async removeTranslation(pageId: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findUnique({
      where: {
        pageId_locale: { pageId, locale },
      },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return this.prisma.contentTranslation.delete({
      where: { id: translation.id },
    });
  }

  async removePage(id: string) {
    await this.findOne(id);

    return this.prisma.contentPage.delete({
      where: { id },
    });
  }
}
