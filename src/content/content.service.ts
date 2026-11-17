import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const SUPPORTED_LOCALES = ['nl', 'en'] as const;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private validateLocale(locale: string) {
    if (
      !SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ) {
      throw new BadRequestException('Unsupported locale');
    }
  }

  async findPublished(slug: string, locale: string) {
    this.validateLocale(locale);

    const translation = await this.prisma.contentTranslation.findFirst({
      where: {
        locale,
        isPublished: true,
        page: { slug },
      },
      select: {
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
      orderBy: { slug: 'asc' },
    });
  }

  async findOne(id: string) {
    const page = await this.prisma.contentPage.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!page) {
      throw new NotFoundException('Content page not found');
    }

    return page;
  }

  async create(slug: string) {
    return this.prisma.contentPage.create({
      data: { slug },
    });
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

    return this.prisma.contentTranslation.upsert({
      where: {
        pageId_locale: { pageId, locale },
      },
      create: {
        pageId,
        locale,
        ...data,
        updatedById: userId,
      },
      update: {
        ...data,
        updatedById: userId,
      },
    });
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
      throw new BadRequestException('Translation requires a title and content');
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
      data: { isPublished: false },
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
