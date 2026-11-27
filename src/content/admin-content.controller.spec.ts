import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ContentStatus, UserRole } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminContentController } from './admin-content.controller';
import { ContentService } from './content.service';

describe('AdminContentController', () => {
  let controller: AdminContentController;

  const validTiptapContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Dit is een test.' }],
      },
    ],
  };

  const contentServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    saveTranslation: jest.fn(),
    updateStatus: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    removeTranslation: jest.fn(),
    removePage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminContentController],
      providers: [
        {
          provide: ContentService,
          useValue: contentServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminContentController>(AdminContentController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes title, locale and content when creating a page', async () => {
    const dto = {
      title: 'About this app',
      locale: 'en' as const,
      content: validTiptapContent,
    };

    const expectedPage = {
      id: 'page-123',
      translations: [],
    };

    contentServiceMock.create.mockResolvedValue(expectedPage);

    const result = await controller.create(dto);

    expect(contentServiceMock.create).toHaveBeenCalledWith(
      'About this app',
      'en',
      validTiptapContent,
    );
    expect(result).toEqual(expectedPage);
  });

  it('applies JWT and role guards to the controller', () => {
    const guards: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminContentController,
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('passes title, content, status and authenticated user ID when saving a translation', async () => {
    const dto = {
      title: 'Testpagina',
      content: validTiptapContent,
      status: ContentStatus.PUBLISHED,
    };

    const request = {
      user: {
        id: 'admin-123',
        role: UserRole.ADMIN,
      },
    };

    const expectedTranslation = {
      id: 'translation-123',
      ...dto,
    };

    contentServiceMock.saveTranslation.mockResolvedValue(
      expectedTranslation,
    );

    const result = await controller.saveTranslation(
      'page-123',
      'nl',
      dto,
      request as unknown as Parameters<
        typeof controller.saveTranslation
      >[3],
    );

    expect(contentServiceMock.saveTranslation).toHaveBeenCalledWith(
      'page-123',
      'nl',
      dto,
      'admin-123',
    );
    expect(result).toEqual(expectedTranslation);
  });

  it('passes the same page ID when adding a second locale', async () => {
    const dto = {
      title: 'About this app',
      content: validTiptapContent,
      status: ContentStatus.DRAFT,
    };

    const expectedTranslation = {
      id: 'translation-en',
      pageId: 'page-123',
      locale: 'en',
    };

    contentServiceMock.saveTranslation.mockResolvedValue(
      expectedTranslation,
    );

    const request = {
      user: {
        id: 'admin-123',
        role: UserRole.ADMIN,
      },
    };

    const result = await controller.saveTranslation(
      'page-123',
      'en',
      dto,
      request as unknown as Parameters<
        typeof controller.saveTranslation
      >[3],
    );

    expect(contentServiceMock.saveTranslation).toHaveBeenCalledWith(
      'page-123',
      'en',
      dto,
      'admin-123',
    );
    expect(result).toEqual(expectedTranslation);
  });

  it.each([
    ContentStatus.DRAFT,
    ContentStatus.PUBLISHED,
    ContentStatus.PRIVATE,
    ContentStatus.ARCHIVED,
  ])('passes the %s status to the separate status endpoint', async (status) => {
    const dto = { status };

    const expectedTranslation = {
      id: 'translation-123',
      status,
    };

    contentServiceMock.updateStatus.mockResolvedValue(expectedTranslation);

    const result = await controller.updateStatus(
      'page-123',
      'nl',
      dto,
    );

    expect(contentServiceMock.updateStatus).toHaveBeenCalledWith(
      'page-123',
      'nl',
      status,
    );
    expect(result).toEqual(expectedTranslation);
  });
});
