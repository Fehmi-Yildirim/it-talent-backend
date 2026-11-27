import { INestApplication, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../generated/prisma/enums';
import { AppModule } from '../src/app.module';
import { ContentService } from '../src/content/content.service';
import { PrismaService } from '../src/database/prisma.service';

describe('Content Admin (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let candidateToken: string;

  const adminUser = {
    id: 'admin-test-id',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    status: 'ACTIVE',
    isDemo: false,
  };

  const candidateUser = {
    id: 'candidate-test-id',
    email: 'candidate@example.com',
    role: UserRole.CANDIDATE,
    status: 'ACTIVE',
    isDemo: false,
  };

  const privateTranslation = {
    id: 'translation-test-id',
    pageId: 'page-test-id',
    locale: 'nl',
    slug: 'over-deze-app',
    title: 'Over deze app',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Private content.' }],
        },
      ],
    },
    status: 'PRIVATE',
    publishedAt: null,
  };

  const contentServiceMock = {
    findPublished: jest
      .fn()
      .mockRejectedValue(new NotFoundException('Published page not found')),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findOne: jest.fn(),
    saveTranslation: jest.fn(),
    updateStatus: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    removeTranslation: jest.fn(),
    removePage: jest.fn(),
  };

  const prismaServiceMock = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        if (where.id === adminUser.id) {
          return Promise.resolve(adminUser);
        }

        if (where.id === candidateUser.id) {
          return Promise.resolve(candidateUser);
        }

        return Promise.resolve(null);
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ContentService)
      .useValue(contentServiceMock)
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = app.get(JwtService);

    adminToken = await jwtService.signAsync({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    candidateToken = await jwtService.signAsync({
      sub: candidateUser.id,
      email: candidateUser.email,
      role: candidateUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests to admin content', async () => {
    await request(app.getHttpServer())
      .get('/admin/content')
      .expect(401);
  });

  it('rejects candidate access to admin content', async () => {
    await request(app.getHttpServer())
      .get('/admin/content/page-test-id')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(403);
  });

  it('allows an admin to change a translation to PRIVATE', async () => {
    contentServiceMock.updateStatus.mockResolvedValue(privateTranslation);

    const response = await request(app.getHttpServer())
      .patch('/admin/content/page-test-id/translations/nl/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PRIVATE' })
      .expect(200);

    expect(contentServiceMock.updateStatus).toHaveBeenCalledWith(
      'page-test-id',
      'nl',
      'PRIVATE',
    );
    expect(response.body).toMatchObject({ status: 'PRIVATE' });
  });

  it('allows an admin to retrieve PRIVATE content', async () => {
    contentServiceMock.findOne.mockResolvedValue({
      id: 'page-test-id',
      translations: [privateTranslation],
    });

    const response = await request(app.getHttpServer())
      .get('/admin/content/page-test-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      translations: [{ status: 'PRIVATE' }],
    });
  });

  it('does not expose PRIVATE content through the public endpoint', async () => {
    await request(app.getHttpServer())
      .get('/content/over-deze-app/nl')
      .expect(404);

    expect(contentServiceMock.findPublished).toHaveBeenCalledWith(
      'over-deze-app',
      'nl',
    );
  });

  it('rejects unauthenticated status changes', async () => {
    await request(app.getHttpServer())
      .patch('/admin/content/page-test-id/translations/nl/status')
      .send({ status: 'PRIVATE' })
      .expect(401);

    expect(contentServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects candidate status changes', async () => {
    await request(app.getHttpServer())
      .patch('/admin/content/page-test-id/translations/nl/status')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ status: 'PRIVATE' })
      .expect(403);

    expect(contentServiceMock.updateStatus).not.toHaveBeenCalled();
  });
});
