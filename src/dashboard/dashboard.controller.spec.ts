import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: serviceStub }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = serviceStub;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /dashboard/statistics delegates to service.getStatistics with the current organization', async () => {
    await controller.getStatistics('org-1');

    expect(service.getStatistics).toHaveBeenCalledWith('org-1');
  });
});

describe('DashboardController /dashboard/statistics (http)', () => {
  let app: INestApplication;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    getStatistics: jest.fn().mockResolvedValue({
      students: { total: 0, active: 0 },
      teachers: { total: 0, active: 0 },
      classes: { total: 0, active: 0, upcoming: 0, ongoing: 0, completed: 0 },
      attendance: {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        attendanceRate: null,
      },
    }),
  };

  let requestUser: { userId: string; organizationId?: string };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: serviceStub }],
    }).compile();

    app = moduleRef.createNestApplication();
    service = serviceStub;
    app.use((req, _res, next) => {
      (req as { user?: unknown }).user = { ...requestUser };
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
    requestUser = { userId: 'user-1', organizationId: 'org-1' };
  });

  it('GET /dashboard/statistics uses the organization from the JWT', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard/statistics');

    expect(res.status).toBe(200);
    expect(service.getStatistics).toHaveBeenCalledWith('org-1');
  });

  it('ignores ?organizationId= because the JWT is the source of truth', async () => {
    const res = await request(app.getHttpServer()).get(
      '/dashboard/statistics?organizationId=org-x',
    );

    expect(res.status).toBe(200);
    expect(service.getStatistics).toHaveBeenCalledWith('org-1');
  });

  it('returns 403 when the request user has no organization', async () => {
    requestUser = { userId: 'user-1' };

    const res = await request(app.getHttpServer()).get('/dashboard/statistics');

    expect(res.status).toBe(403);
    expect(service.getStatistics).not.toHaveBeenCalled();
  });
});
