import { join } from 'path';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { AuthorizationService } from '../authorization/services/authorization.service';

const IMPORT_JOB_ID = '11111111-2222-4333-8444-555555555555';
const SAMPLE_FILE = join(
  process.cwd(),
  'src',
  'templates',
  'student-import-sample-vi.xlsx',
);

const serviceStub = {
  getStudentImportMeta: jest.fn(),
  getTeacherImportMeta: jest.fn(),
  previewStudentImport: jest.fn(),
  confirmStudentImport: jest.fn(),
  previewTeacherImport: jest.fn(),
  confirmTeacherImport: jest.fn(),
};

const authServiceMock = {
  hasPermission: jest.fn().mockResolvedValue(true),
};

describe('ImportsController', () => {
  let controller: ImportsController;
  let service: { [key: string]: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        { provide: ImportsService, useValue: serviceStub },
        { provide: AuthorizationService, useValue: authServiceMock },
      ],
    }).compile();

    controller = module.get<ImportsController>(ImportsController);
    service = serviceStub;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /imports/students/meta delegates to service.getStudentImportMeta', () => {
    controller.getStudentImportMeta();
    expect(service.getStudentImportMeta).toHaveBeenCalledTimes(1);
  });

  it('GET /imports/teachers/meta delegates to service.getTeacherImportMeta', () => {
    controller.getTeacherImportMeta();
    expect(service.getTeacherImportMeta).toHaveBeenCalledTimes(1);
  });

  it('POST /imports/students/preview passes the actor and the current organization', async () => {
    const file = { originalname: 'students.xlsx' } as Express.Multer.File;

    await controller.previewStudentImport('user-1', 'org-1', file);

    expect(service.previewStudentImport).toHaveBeenCalledWith(
      file,
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/students/confirm passes the actor and the current organization', async () => {
    await controller.confirmStudentImport('user-1', 'org-1', {
      importJobId: IMPORT_JOB_ID,
    });

    expect(service.confirmStudentImport).toHaveBeenCalledWith(
      IMPORT_JOB_ID,
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/teachers/preview passes the actor and the current organization', async () => {
    const file = { originalname: 'teachers.xlsx' } as Express.Multer.File;

    await controller.previewTeacherImport('user-1', 'org-1', file);

    expect(service.previewTeacherImport).toHaveBeenCalledWith(
      file,
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/teachers/confirm passes the actor and the current organization', async () => {
    await controller.confirmTeacherImport('user-1', 'org-1', {
      importJobId: IMPORT_JOB_ID,
    });

    expect(service.confirmTeacherImport).toHaveBeenCalledWith(
      IMPORT_JOB_ID,
      'user-1',
      'org-1',
    );
  });
});

describe('ImportsController /imports (http)', () => {
  let app: INestApplication;
  let service: { [key: string]: jest.Mock };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        { provide: ImportsService, useValue: serviceStub },
        { provide: AuthorizationService, useValue: authServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    service = serviceStub;
    app.use((req, _res, next) => {
      (req as { user?: unknown }).user = {
        userId: 'user-1',
        organizationId: 'org-1',
      };
      (req as { organizationId?: string }).organizationId = 'org-1';
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
    service.getStudentImportMeta.mockReturnValue({
      headers: ['student_code'],
      headerLabels: {},
      maxFileSizeBytes: 1024,
      allowedExtensions: ['.xlsx'],
    });
    service.getTeacherImportMeta.mockReturnValue({
      headers: ['email'],
      headerLabels: {},
      maxFileSizeBytes: 1024,
      allowedExtensions: ['.xlsx'],
    });
    service.previewStudentImport.mockResolvedValue({
      importJobId: 'job-1',
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      rows: [],
    });
    service.previewTeacherImport.mockResolvedValue({
      importJobId: 'job-1',
      total: 0,
      valid: 0,
      invalid: 0,
      rows: [],
    });
    service.confirmStudentImport.mockResolvedValue({
      importJobId: 'job-1',
      total: 0,
      success: 0,
      failed: 0,
      rows: [],
    });
    service.confirmTeacherImport.mockResolvedValue({
      importJobId: 'job-1',
      total: 0,
      success: 0,
      failed: 0,
      rows: [],
    });
  });

  it('GET /imports/students/meta returns the student import metadata', async () => {
    const res = await request(app.getHttpServer()).get(
      '/imports/students/meta',
    );

    expect(res.status).toBe(200);
    expect(res.body.headers).toEqual(['student_code']);
  });

  it('POST /imports/students/preview uses the organization from the JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/students/preview')
      .attach('file', SAMPLE_FILE);

    expect(res.status).toBe(201);
    expect(service.previewStudentImport).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'student-import-sample-vi.xlsx',
      }),
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/students/preview ignores ?organizationId= and keeps the JWT organization', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/students/preview?organizationId=org-x')
      .attach('file', SAMPLE_FILE);

    expect(res.status).toBe(201);
    expect(service.previewStudentImport).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/students/confirm uses the organization from the JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/students/confirm')
      .send({ importJobId: IMPORT_JOB_ID });

    expect(res.status).toBe(201);
    expect(service.confirmStudentImport).toHaveBeenCalledWith(
      IMPORT_JOB_ID,
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/students/confirm ignores ?organizationId= and keeps the JWT organization', async () => {
    const res = await request(app.getHttpServer())
      .post(`/imports/students/confirm?organizationId=org-x`)
      .send({ importJobId: IMPORT_JOB_ID });

    expect(res.status).toBe(201);
    expect(service.confirmStudentImport).toHaveBeenCalledWith(
      IMPORT_JOB_ID,
      'user-1',
      'org-1',
    );
  });

  it('POST /imports/students/confirm rejects organizationId in the body with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/students/confirm')
      .send({ importJobId: IMPORT_JOB_ID, organizationId: 'org-x' });

    expect(res.status).toBe(400);
    expect(service.confirmStudentImport).not.toHaveBeenCalled();
  });

  it('POST /imports/students/confirm rejects a missing importJobId with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/imports/students/confirm')
      .send({});

    expect(res.status).toBe(400);
    expect(service.confirmStudentImport).not.toHaveBeenCalled();
  });

  it('POST /imports/teachers/confirm ignores ?organizationId= and keeps the JWT organization', async () => {
    const res = await request(app.getHttpServer())
      .post(`/imports/teachers/confirm?organizationId=org-x`)
      .send({ importJobId: IMPORT_JOB_ID });

    expect(res.status).toBe(201);
    expect(service.confirmTeacherImport).toHaveBeenCalledWith(
      IMPORT_JOB_ID,
      'user-1',
      'org-1',
    );
  });
});
