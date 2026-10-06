import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { ClassStatus } from './entities/class.entity';
import { AuthorizationService } from '../authorization/services/authorization.service';

describe('ClassesController', () => {
  let controller: ClassesController;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    duplicate: jest.fn(),
  };

  const authServiceMock = {
    hasPermission: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        { provide: ClassesService, useValue: serviceStub },
        { provide: AuthorizationService, useValue: authServiceMock },
      ],
    }).compile();

    controller = module.get<ClassesController>(ClassesController);
    service = serviceStub;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /classes delegates to service.create with the current organization', async () => {
    const dto = {
      branchId: '11111111-2222-4333-8444-555555555555',
      courseId: '11111111-2222-4333-8444-555555555556',
      name: 'Lớp Toán 10A',
      code: 'T10A',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      capacity: 30,
    };

    await controller.create('org-1', dto);

    expect(service.create).toHaveBeenCalledWith(dto, 'org-1');
  });

  it('GET /classes delegates to service.findAll with the current organization', async () => {
    const query = { status: ClassStatus.ACTIVE };

    await controller.findAll('org-1', query);

    expect(service.findAll).toHaveBeenCalledWith(query, 'org-1');
  });

  it('GET /classes/:id delegates to service.findOne', async () => {
    await controller.findOne('org-1', 'c-1');
    expect(service.findOne).toHaveBeenCalledWith('c-1', 'org-1');
  });

  it('PATCH /classes/:id delegates to service.update', async () => {
    const dto = { name: 'Lớp Toán 10B' };

    await controller.update('org-1', 'c-1', dto);

    expect(service.update).toHaveBeenCalledWith('c-1', dto, 'org-1');
  });

  it('DELETE /classes/:id passes the actor user id and the current organization', async () => {
    await controller.remove('user-1', 'org-1', 'c-1');
    expect(service.remove).toHaveBeenCalledWith('user-1', 'c-1', 'org-1');
  });

  it('POST /classes/:id/duplicate delegates to service.duplicate', async () => {
    await controller.duplicate('org-1', 'c-1');
    expect(service.duplicate).toHaveBeenCalledWith('c-1', 'org-1');
  });
});

describe('ClassesController /classes (http)', () => {
  let app: INestApplication;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    create: jest.fn().mockResolvedValue({ id: 'c-1' }),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'c-1' }),
    update: jest.fn().mockResolvedValue({ id: 'c-1' }),
    remove: jest.fn().mockResolvedValue({ id: 'c-1' }),
    duplicate: jest.fn().mockResolvedValue({ id: 'c-1' }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        { provide: ClassesService, useValue: serviceStub },
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
  });

  it('GET /classes scopes the query to the organization from the JWT', async () => {
    const res = await request(app.getHttpServer()).get('/classes');

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith(expect.anything(), 'org-1');
  });

  it('GET /classes passes valid filters together with the current organization', async () => {
    const res = await request(app.getHttpServer()).get(
      '/classes?status=ACTIVE',
    );

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
      'org-1',
    );
  });

  it('rejects ?organizationId=org-x with 400 because the JWT is the source of truth', async () => {
    const res = await request(app.getHtttpServer()).get(
      '/classes?organizationId=org-x',
    );

    expect(res.status).toBe(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('POST /classes uses the organization from the request user', async () => {
    const dto = {
      branchId: '11111111-2222-4333-8444-555555555555',
      courseId: '11111111-2222-4333-8444-555555555556',
      name: 'Lớp Toán 10A',
      code: 'T10A',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      capacity: 30,
    };

    const res = await request(app.getHttpServer()).post('/classes').send(dto);

    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Lớp Toán 10A' }),
      'org-1',
    );
  });

  it('DELETE /classes/:id passes the JWT user and organization', async () => {
    const res = await request(app.getHttpServer()).delete('/classes/c-1');

    expect(res.status).toBe(200);
    expect(service.remove).toHaveBeenCalledWith('user-1', 'c-1', 'org-1');
  });

  it('POST /classes/:id/duplicate uses the current organization', async () => {
    const res = await request(app.getHttpServer()).post(
      '/classes/c-1/duplicate',
    );

    expect(res.status).toBe(201);
    expect(service.duplicate).toHaveBeenCalledWith('c-1', 'org-1');
  });
});
