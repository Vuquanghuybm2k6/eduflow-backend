import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentExportService } from './export/student-export.service';
import { StudentImportTemplateService } from './import/student-import-template.service';
import { Student } from './entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Branch } from '../branches/entities/branch.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const exportServiceMock = {
  export: jest.fn().mockResolvedValue({
    buffer: Buffer.from('fake-xlsx-bytes'),
    filename: 'students-2026-09-04.xlsx',
  }),
};

const templateServiceMock = {
  download: jest.fn().mockResolvedValue({
    buffer: Buffer.from('fake-template-xlsx-bytes'),
    filename: 'student-import-sample-vi.xlsx',
  }),
};

describe('StudentsController', () => {
  let controller: StudentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        StudentsService,
        {
          provide: getRepositoryToken(Student),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOneBy: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: { findOne: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Branch),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
        {
          provide: StudentExportService,
          useValue: exportServiceMock,
        },
        {
          provide: StudentImportTemplateService,
          useValue: templateServiceMock,
        },
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /students/import/template delegates to studentImportTemplateService.download', async () => {
    await controller.downloadImportTemplate('user-1');
    expect(templateServiceMock.download).toHaveBeenCalledWith('user-1', 'vi');
  });

  it('passes the requested language to studentImportTemplateService.download', async () => {
    await controller.downloadImportTemplate('user-1', { lang: 'en' });
    expect(templateServiceMock.download).toHaveBeenCalledWith('user-1', 'en');
  });
});

describe('StudentsController /students/export (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: StudentsService, useValue: {} },
        { provide: StudentExportService, useValue: exportServiceMock },
        {
          provide: StudentImportTemplateService,
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
    const res = await request(app.getHttpServer()).get('/students/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="students-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(exportServiceMock.export).toHaveBeenCalled();
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/students/export?status=BANNED',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('rejects an invalid branchId with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/students/export?branchId=not-a-uuid',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('rejects unknown query parameters (e.g. pagination) with 400', async () => {
    const res = await request(app.getHttpServer()).get(
      '/students/export?page=1&limit=20',
    );

    expect(res.status).toBe(400);
    expect(exportServiceMock.export).not.toHaveBeenCalled();
  });

  it('passes valid filters to the export service', async () => {
    const res = await request(app.getHttpServer()).get(
      '/students/export?search=Nguyen&status=ACTIVE&branchId=11111111-2222-4333-8444-555555555555',
    );

    expect(res.status).toBe(200);
    expect(exportServiceMock.export).toHaveBeenCalledWith(undefined, {
      search: 'Nguyen',
      status: 'ACTIVE',
      branchId: '11111111-2222-4333-8444-555555555555',
    });
  });

  it('GET /students/import/template returns an xlsx attachment with a safe filename', async () => {
    templateServiceMock.download.mockClear();

    const res = await request(app.getHttpServer()).get(
      '/students/import/template',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="student-import-sample-vi.xlsx"',
    );
    expect(templateServiceMock.download).toHaveBeenCalledWith(undefined, 'vi');
  });
});
