import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ClassSessionsController } from './class-sessions.controller';
import { ClassSessionsService } from './class-sessions.service';
import { GenerateSessionsDto } from './dto/generate-sessions.dto';

describe('ClassSessionsController', () => {
  let controller: ClassSessionsController;
  const classSessionsService = {
    generate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionsController],
      providers: [
        { provide: ClassSessionsService, useValue: classSessionsService },
      ],
    }).compile();

    controller = module.get<ClassSessionsController>(ClassSessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('delegates to the service with the user, class and organization context', async () => {
      const dto: GenerateSessionsDto = {
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      };
      classSessionsService.generate.mockResolvedValue({ created: 1 });

      const result = await controller.generate(
        'user-1',
        'org-1',
        'class-1',
        dto,
      );

      expect(classSessionsService.generate).toHaveBeenCalledWith(
        'user-1',
        'class-1',
        dto,
        'org-1',
      );
      expect(result).toEqual({ created: 1 });
    });
  });

  describe('findAll', () => {
    it('delegates to the service with the class and organization context', async () => {
      classSessionsService.findAll.mockResolvedValue([]);

      await controller.findAll('org-1', 'class-1', {
        status: undefined,
      });

      expect(classSessionsService.findAll).toHaveBeenCalledWith(
        'class-1',
        {},
        'org-1',
      );
    });
  });

  describe('findOne', () => {
    it('delegates to the service with the session id', async () => {
      classSessionsService.findOne.mockResolvedValue({ id: 'session-1' });

      const result = await controller.findOne('org-1', 'class-1', 'session-1');

      expect(classSessionsService.findOne).toHaveBeenCalledWith(
        'class-1',
        'session-1',
        'org-1',
      );
      expect(result).toEqual({ id: 'session-1' });
    });
  });
});

describe('ClassSessionsController /classes/:classId/sessions (http)', () => {
  let app: INestApplication;
  let service: { [key: string]: jest.Mock };

  const classId = '11111111-2222-4333-8444-555555555555';
  const sessionId = '22222222-3333-4444-9555-666666666666';

  const serviceStub = {
    generate: jest.fn().mockResolvedValue({ created: 1 }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: sessionId }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionsController],
      providers: [{ provide: ClassSessionsService, useValue: serviceStub }],
    }).compile();

    app = moduleRef.createNestApplication();
    service = serviceStub;
    app.use((req, _res, next) => {
      (req as { user?: unknown }).user = {
        userId: 'user-1',
        organizationId: 'org-1',
      };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /classes/:classId/sessions/generate uses the organization from the request user', async () => {
    const dto = {
      startDate: '2026-01-05',
      endDate: '2026-01-11',
    };

    const res = await request(app.getHttpServer())
      .post(`/classes/${classId}/sessions/generate`)
      .send(dto);

    expect(res.status).toBe(201);
    expect(service.generate).toHaveBeenCalledWith(
      'user-1',
      classId,
      expect.objectContaining({ startDate: '2026-01-05' }),
      'org-1',
    );
  });

  it('GET /classes/:classId/sessions scopes the query to the organization from the JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      `/classes/${classId}/sessions`,
    );

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith(
      classId,
      expect.anything(),
      'org-1',
    );
  });

  it('GET /classes/:classId/sessions passes valid filters together with the current organization', async () => {
    const res = await request(app.getHttpServer()).get(
      `/classes/${classId}/sessions?startDate=2026-01-01&endDate=2026-01-31`,
    );

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith(
      classId,
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
      'org-1',
    );
  });

  it('rejects ?organizationId=org-x with 400 because the JWT is the source of truth', async () => {
    const res = await request(app.getHttpServer()).get(
      `/classes/${classId}/sessions?organizationId=org-x`,
    );

    expect(res.status).toBe(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('GET /classes/:classId/sessions/:sessionId uses the organization from the JWT', async () => {
    const res = await request(app.getHttpServer()).get(
      `/classes/${classId}/sessions/${sessionId}`,
    );

    expect(res.status).toBe(200);
    expect(service.findOne).toHaveBeenCalledWith(classId, sessionId, 'org-1');
  });
});
