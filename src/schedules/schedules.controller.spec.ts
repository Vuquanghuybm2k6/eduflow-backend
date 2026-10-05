import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { DayOfWeek } from './entities/schedule.entity';

const classId = '11111111-2222-4333-8444-555555555555';
const scheduleId = '22222222-3333-4444-8555-666666666666';

const serviceStub: { [key: string]: jest.Mock } = {
  getCalendar: jest.fn(),
  create: jest.fn(),
  createBulk: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('SchedulesController', () => {
  let controller: SchedulesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [{ provide: SchedulesService, useValue: serviceStub }],
    }).compile();

    controller = module.get<SchedulesController>(SchedulesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /schedules/calendar delegates to service.getCalendar with user + org context', async () => {
    const query = { startDate: '2026-09-07', endDate: '2026-09-13' };
    await controller.calendar('user-1', 'org-1', query);

    expect(serviceStub.getCalendar).toHaveBeenCalledWith(
      'user-1',
      query,
      'org-1',
    );
  });

  it('POST /classes/:classId/schedules delegates to service.create', async () => {
    const dto = {
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '18:00',
      endTime: '20:00',
    };
    await controller.create('org-1', classId, dto);

    expect(serviceStub.create).toHaveBeenCalledWith(classId, dto, 'org-1');
  });

  it('POST /classes/:classId/schedules/bulk delegates to service.createBulk', async () => {
    const dto = {
      sessions: [
        { dayOfWeek: DayOfWeek.MONDAY, startTime: '18:00', endTime: '20:00' },
      ],
    };
    await controller.createBulk('org-1', classId, dto);

    expect(serviceStub.createBulk).toHaveBeenCalledWith(classId, dto, 'org-1');
  });

  it('GET /classes/:classId/schedules delegates to service.findAll', async () => {
    await controller.findAll('org-1', classId);

    expect(serviceStub.findAll).toHaveBeenCalledWith(classId, 'org-1');
  });

  it('PATCH /schedules/:id delegates to service.update', async () => {
    const dto = { room: 'A101' };
    await controller.update('org-1', scheduleId, dto);

    expect(serviceStub.update).toHaveBeenCalledWith(scheduleId, dto, 'org-1');
  });

  it('DELETE /schedules/:id delegates to service.remove with the actor user', async () => {
    await controller.remove('user-1', 'org-1', scheduleId);

    expect(serviceStub.remove).toHaveBeenCalledWith(
      'user-1',
      scheduleId,
      'org-1',
    );
  });
});

describe('SchedulesController (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [{ provide: SchedulesService, useValue: serviceStub }],
    }).compile();

    app = moduleRef.createNestApplication();
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

  it('GET /schedules/calendar uses the organization from the authenticated user', async () => {
    const res = await request(app.getHttpServer()).get(
      '/schedules/calendar?startDate=2026-09-07&endDate=2026-09-13',
    );

    expect(res.status).toBe(200);
    expect(serviceStub.getCalendar).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      }),
      'org-1',
    );
  });

  it('rejects a client-sent ?organizationId with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/schedules/calendar?startDate=2026-09-07&endDate=2026-09-13&organizationId=org-x',
    );

    expect(res.status).toBe(400);
    expect(serviceStub.getCalendar).not.toHaveBeenCalled();
  });

  it('POST /classes/:classId/schedules passes the JWT organization', async () => {
    const dto = {
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '18:00',
      endTime: '20:00',
    };
    const res = await request(app.getHttpServer())
      .post(`/classes/${classId}/schedules`)
      .send(dto);

    expect(res.status).toBe(201);
    expect(serviceStub.create).toHaveBeenCalledWith(classId, dto, 'org-1');
  });

  it('GET /classes/:classId/schedules passes the JWT organization', async () => {
    const res = await request(app.getHttpServer()).get(
      `/classes/${classId}/schedules`,
    );

    expect(res.status).toBe(200);
    expect(serviceStub.findAll).toHaveBeenCalledWith(classId, 'org-1');
  });

  it('DELETE /schedules/:id passes the actor user and the JWT organization', async () => {
    const res = await request(app.getHttpServer()).delete(
      `/schedules/${scheduleId}`,
    );

    expect(res.status).toBe(200);
    expect(serviceStub.remove).toHaveBeenCalledWith(
      'user-1',
      scheduleId,
      'org-1',
    );
  });
});
