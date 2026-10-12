import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';
import { setupSwagger } from '../config/swagger';

describe('Swagger (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the OpenAPI document at /docs-json', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.info.title).toBe('EduFlow API');
    expect(res.body.paths['/health']).toBeDefined();
  });
});
