
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
        isPublished: true,
      },
      select: {
        slug: true,
        locale: true,
        publishedTitle: true,
        publishedIntroduction: true,
        publishedContent: true,
        publishedAt: true,
      },
    });

    if (!translation) {
      throw new NotFoundException('Published page not found');
    }

    return translation;
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


  async create(title: string, locale: string) {
    this.validateLocale(locale);

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
              draftTitle: normalizedTitle,
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
      draftTitle?: string;
      draftIntroduction?: string;
      draftContent?: object;
    },
    userId: string,
  ) {
    this.validateLocale(locale);
    await this.findOne(pageId);

    const existing = await this.prisma.contentTranslation.findUnique({
      where: {
        pageId_locale: { pageId, locale },
      },
    });

    if (existing) {
      return this.prisma.contentTranslation.update({
        where: { id: existing.id },
        data: {
          ...data,
          updatedById: userId,
        },
      });
    }

    if (!data.draftTitle?.trim()) {
      throw new BadRequestException(
        'A title is required to create a translation',
      );
    }

    const normalizedTitle = data.draftTitle.trim();
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
            draftTitle: normalizedTitle,
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
          return this.prisma.contentTranslation.update({
            where: { id: concurrentlyCreated.id },
            data: {
              ...data,
              updatedById: userId,
            },
          });
        }
      }
    }

    throw new BadRequestException(
      'Could not generate a unique slug for this translation',
    );
  }

  async publish(pageId: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findUnique({
      where: { pageId_locale: { pageId, locale } },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    if (
      typeof translation.draftTitle !== 'string' ||
      translation.draftTitle.trim().length === 0 ||
      translation.draftContent === null
    ) {
      throw new BadRequestException(
        'Translation requires a title and content',
      );
    }

    return this.prisma.contentTranslation.update({
      where: { id: translation.id },
      data: {
        publishedTitle: translation.draftTitle,
        publishedIntroduction: translation.draftIntroduction,
        publishedContent: translation.draftContent,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(pageId: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findUnique({
      where: { pageId_locale: { pageId, locale } },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return this.prisma.contentTranslation.update({
      where: { id: translation.id },
      data: {
        isPublished: false,
      },
    });
  }

  async removeTranslation(pageId: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findUnique({
      where: { pageId_locale: { pageId, locale } },
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
