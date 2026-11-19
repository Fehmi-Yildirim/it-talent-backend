import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '../../generated/prisma/enums';
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
        content: [
          {
            type: 'text',
            text: 'Dit is een test.',
          },
        ],
      },
    ],
  };

  const contentServiceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    saveTranslation: jest.fn(),
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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the title, locale and draft content when creating a page', async () => {
    const dto = {
      title: 'About this app',
      locale: 'en' as const,
      draftContent: validTiptapContent,
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

  it('should apply JWT and role guards to the controller', () => {
    const guards: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminContentController,
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('should pass the authenticated user ID when saving a translation', async () => {
    const dto = {
      draftTitle: 'Testpagina',
      draftContent: validTiptapContent,
    };

    const request = {
      user: {
        id: 'admin-123',
        role: UserRole.ADMIN,
      },
    };

    await controller.saveTranslation(
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
  });

  it('should pass the same page ID when adding a second locale', async () => {
    const dto = {
      draftTitle: 'About this app',
      draftContent: validTiptapContent,
    };

    const request = {
      user: {
        id: 'admin-123',
        role: UserRole.ADMIN,
      },
    };

    const expectedTranslation = {
      id: 'translation-en',
      pageId: 'page-123',
      locale: 'en',
    };

    contentServiceMock.saveTranslation.mockResolvedValue(
      expectedTranslation,
    );

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
});
