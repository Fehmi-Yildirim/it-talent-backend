import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ContentService } from './../src/content/content.service';
import { NotFoundException } from '@nestjs/common';

describe('Content Admin (e2e)', () => {
  let app: INestApplication<App>;

  const contentServiceMock = {
    findPublished: jest
      .fn()
      .mockRejectedValue(new NotFoundException('Published page not found')),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findOne: jest.fn(),
    saveTranslation: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    removeTranslation: jest.fn(),
    removePage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ContentService)
      .useValue(contentServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/admin/content').expect(401);
  });

  it('should keep the public content endpoint accessible', async () => {
    await request(app.getHttpServer())
      .get('/content/non-existing-page/nl')
      .expect(404);
  });
});
