import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { TeacherExportService } from './export/teacher-export.service';
import { TeacherImportTemplateService } from './import/teacher-import-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const exportServiceMock = {
  export: jest.fn().mockResolvedValue({
    buffer: Buffer.from('fake-xlsx-bytes'),
    filename: 'teachers-2026-09-04.xlsx',
  }),
};

const templateServiceMock = {
  download: jest.fn().mockResolvedValue({
    buffer: Buffer.from('fake-template-xlsx-bytes'),
    filename: 'teacher-import-sample-vi.xlsx',
  }),
};

describe('TeachersController', () => {
  let controller: TeachersController;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findMe: jest.fn(),
    findMyClasses: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeachersController],
      providers: [
        { provide: TeachersService, useValue: serviceStub },
        { provide: TeacherExportService, useValue: exportServiceMock },
        {
          provide: TeacherImportTemplateService,
          useValue: templateServiceMock,
        },
      ],
    }).compile();

    controller = module.get<TeachersController>(TeachersController);
    service = serviceStub;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /teachers delegates to service.create with user + org context', async () => {
    const dto = { fullName: 'A', email: 'a@b.com', teacherCode: 'GV001' };
    await controller.create('user-1', dto, 'org-1');
    expect(service.create).toHaveBeenCalledWith('user-1', dto, {
      organizationId: 'org-1',
    });
  });

  it('GET /teachers delegates to service.findAll', async () => {
    await controller.findAll('user-1', 'org-1');
    expect(service.findAll).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });

  it('GET /teachers/export delegates to teacherExportService.export', async () => {
    const query = {
      search: 'Nguyen',
      status: 'ACTIVE' as const,
      branchId: 'b-1',
    };
    await controller.exportTeachers('user-1', query);
    expect(exportServiceMock.export).toHaveBeenCalledWith('user-1', query);
  });

  it('GET /teachers/import/template delegates to teacherImportTemplateService.download', async () => {
    await controller.downloadImportTemplate('user-1');
    expect(templateServiceMock.download).toHaveBeenCalledWith('user-1', 'vi');
  });

  it('passes the requested language to teacherImportTemplateService.download', async () => {
    await controller.downloadImportTemplate('user-1', { lang: 'en' });
    expect(templateServiceMock.download).toHaveBeenCalledWith('user-1', 'en');
  });

  it('GET /teachers/me delegates to service.findMe', async () => {
    await controller.findMe('user-1', 'org-1');
    expect(service.findMe).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });

  it('GET /teachers/me/classes delegates to service.findMyClasses', async () => {
    await controller.findMyClasses('user-1', 'org-1');
    expect(service.findMyClasses).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });

  it('GET /teachers/:id delegates to service.findOne', async () => {
    await controller.findOne('user-1', 't-1', 'org-1');
    expect(service.findOne).toHaveBeenCalledWith('user-1', 't-1', {
      organizationId: 'org-1',
    });
  });

  it('PATCH /teachers/:id delegates to service.update', async () => {
    const dto = { specialization: 'Backend' };
    await controller.update('user-1', 't-1', dto, 'org-1');
    expect(service.update).toHaveBeenCalledWith('user-1', 't-1', dto, {
      organizationId: 'org-1',
    });
  });

  it('PATCH /teachers/:id/status delegates to service.updateStatus', async () => {
    const dto = { status: 'INACTIVE' as const };
    await controller.updateStatus('user-1', 't-1', dto, 'org-1');
    expect(service.updateStatus).toHaveBeenCalledWith('user-1', 't-1', dto, {
      organizationId: 'org-1',
    });
  });
});

describe('TeachersController /teachers/export (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TeachersController],
      providers: [
        { provide: TeachersService, useValue: {} },
        { provide: TeacherExportService, useValue: exportServiceMock },
        {
          provide: TeacherImportTemplateService,
          useValue: templateServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
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
    exportServiceMock.export.mockClear();
  });

  it('returns an xlsx attachment with a safe filename', async () => {
    const res = await request(app.getHttpServer()).get('/teachers/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="teachers-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(exportServiceMock.export).toHaveBeenCalled();
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/teachers/export?status=BANNED',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('rejects an invalid branchId with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/teachers/export?branchId=not-a-uuid',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('rejects unknown query parameters (e.g. pagination) with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/teachers/export?page=1&limit=20',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('passes valid filters to the export service', async () => {
    const res = await request(app.getHttpServer()).get(
      '/teachers/export?search=Nguyen&status=ACTIVE&branchId=11111111-2222-4333-8444-555555555555',
    );

    expect(res.status).toBe(200);
    expect(exportServiceMock.export).toHaveBeenCalledWith(undefined, {
      search: 'Nguyen',
      status: 'ACTIVE',
      branchId: '11111111-2222-4333-8444-555555555555',
    });
  });

  it('GET /teachers/import/template returns an xlsx attachment with a safe filename', async () => {
    templateServiceMock.download.mockClear();

    const res = await request(app.getHttpServer()).get(
      '/teachers/import/template',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="teacher-import-sample-vi.xlsx"',
    );
    expect(templateServiceMock.download).toHaveBeenCalledWith(undefined, 'vi');
  });
});
