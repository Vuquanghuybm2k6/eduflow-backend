import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  const attendanceService = {
    getSessionAttendance: jest.fn(),
    updateSessionAttendance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSessionAttendance', () => {
    it('delegates to the service with the current organization', async () => {
      attendanceService.getSessionAttendance.mockResolvedValue({
        role: 'teacher',
      });

      const result = await controller.getSessionAttendance(
        'user-1',
        'org-1',
        'session-1',
      );

      expect(attendanceService.getSessionAttendance).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'session-1',
      );
      expect(result).toEqual({ role: 'teacher' });
    });
  });

  describe('updateSessionAttendance', () => {
    it('delegates to the service with the dto and the current organization', async () => {
      const dto: UpdateAttendanceDto = { records: [] };
      attendanceService.updateSessionAttendance.mockResolvedValue({
        sessionId: 'session-1',
      });

      const result = await controller.updateSessionAttendance(
        'user-1',
        'org-1',
        'session-1',
        dto,
      );

      expect(attendanceService.updateSessionAttendance).toHaveBeenCalledWith(
        'user-1',
        'session-1',
        dto,
        'org-1',
      );
      expect(result).toEqual({ sessionId: 'session-1' });
    });
  });
});

describe('AttendanceController attendance routes (http)', () => {
  let app: INestApplication;

  const attendanceService = {
    getSessionAttendance: jest.fn(),
    updateSessionAttendance: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: attendanceService }],
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

  it('GET resolves the organization from the JWT and delegates to the service', async () => {
    attendanceService.getSessionAttendance.mockResolvedValue({ role: 'admin' });

    const res = await request(app.getHttpServer()).get(
      `/sessions/${SESSION_ID}/attendance`,
    );

    expect(res.status).toBe(200);
    expect(attendanceService.getSessionAttendance).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      SESSION_ID,
    );
  });

  it('ignores an organizationId query parameter (context comes from the JWT)', async () => {
    attendanceService.getSessionAttendance.mockResolvedValue({ role: 'admin' });

    const res = await request(app.getHttpServer()).get(
      `/sessions/${SESSION_ID}/attendance?organizationId=org-x`,
    );

    expect(res.status).toBe(200);
    expect(attendanceService.getSessionAttendance).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      SESSION_ID,
    );
  });

  it('PUT resolves the organization from the JWT and delegates to the service', async () => {
    const body = {
      records: [{ studentId: STUDENT_ID, status: 'PRESENT' }],
    };
    attendanceService.updateSessionAttendance.mockResolvedValue({
      sessionId: SESSION_ID,
    });

    const res = await request(app.getHttpServer())
      .put(`/sessions/${SESSION_ID}/attendance`)
      .send(body);

    expect(res.status).toBe(200);
    expect(attendanceService.updateSessionAttendance).toHaveBeenCalledWith(
      'user-1',
      SESSION_ID,
      {
        records: [{ studentId: STUDENT_ID, status: 'PRESENT' }],
      },
      'org-1',
    );
  });

  it('rejects an organizationId in the PUT body with 400', async () => {
    const body = {
      organizationId: 'org-x',
      records: [{ studentId: STUDENT_ID, status: 'PRESENT' }],
    };

    const res = await request(app.getHttpServer())
      .put(`/sessions/${SESSION_ID}/attendance`)
      .send(body);

    expect(res.status).toBe(400);
    expect(attendanceService.updateSessionAttendance).not.toHaveBeenCalled();
  });
});
