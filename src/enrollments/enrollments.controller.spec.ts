import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentStatus } from './entities/enrollment.entity';

const serviceStub = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByStudent: jest.fn(),
  findByClass: jest.fn(),
  updateStatus: jest.fn(),
  remove: jest.fn(),
};

const createDto = {
  studentId: '11111111-2222-4333-8444-555555555555',
  classId: '11111111-2222-4333-8444-555555555556',
};

async function createApp(user: { userId: string; organizationId?: string }) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [EnrollmentsController],
    providers: [{ provide: EnrollmentsService, useValue: serviceStub }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    (req as { user?: unknown }).user = user;
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

  return app;
}

describe('EnrollmentsController', () => {
  let controller: EnrollmentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [{ provide: EnrollmentsService, useValue: serviceStub }],
    }).compile();

    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /enrollments delegates to service.create with the current organization', async () => {
    await controller.create('org-1', createDto);

    expect(serviceStub.create).toHaveBeenCalledWith(createDto, 'org-1');
  });

  it('GET /enrollments delegates to service.findAll with the current organization', async () => {
    await controller.findAll('org-1');

    expect(serviceStub.findAll).toHaveBeenCalledWith('org-1');
  });

  it('GET /enrollments/:id delegates to service.findOne', async () => {
    await controller.findOne('org-1', 'e-1');

    expect(serviceStub.findOne).toHaveBeenCalledWith('e-1', 'org-1');
  });

  it('GET /enrollments/student/:studentId delegates to service.findByStudent', async () => {
    await controller.findByStudent('org-1', 's-1');

    expect(serviceStub.findByStudent).toHaveBeenCalledWith('s-1', 'org-1');
  });

  it('GET /enrollments/class/:classId delegates to service.findByClass', async () => {
    await controller.findByClass('org-1', 'c-1');

    expect(serviceStub.findByClass).toHaveBeenCalledWith('c-1', 'org-1');
  });

  it('PATCH /enrollments/:id/status delegates to service.updateStatus', async () => {
    const dto = { status: EnrollmentStatus.CANCELLED };

    await controller.updateStatus('org-1', 'e-1', dto);

    expect(serviceStub.updateStatus).toHaveBeenCalledWith('e-1', dto, 'org-1');
  });

  it('DELETE /enrollments/:id delegates to service.remove', async () => {
    await controller.remove('org-1', 'e-1');

    expect(serviceStub.remove).toHaveBeenCalledWith('e-1', 'org-1');
  });
});

describe('EnrollmentsController /enrollments (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ userId: 'user-1', organizationId: 'org-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /enrollments scopes the query to the organization from the JWT', async () => {
    const res = await request(app.getHttpServer()).get('/enrollments');

    expect(res.status).toBe(200);
    expect(serviceStub.findAll).toHaveBeenCalledWith('org-1');
  });

  it('ignores an ?organizationId query parameter (context comes from the JWT)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/enrollments?organizationId=org-x',
    );

    expect(res.status).toBe(200);
    expect(serviceStub.findAll).toHaveBeenCalledWith('org-1');
  });

  it('POST /enrollments uses the organization from the request user', async () => {
    const res = await request(app.getHttpServer())
      .post('/enrollments')
      .send(createDto);

    expect(res.status).toBe(201);
    expect(serviceStub.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: createDto.studentId }),
      'org-1',
    );
  });

  it('rejects an organizationId in the body with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/enrollments')
      .send({ ...createDto, organizationId: 'org-x' });

    expect(res.status).toBe(400);
    expect(serviceStub.create).not.toHaveBeenCalled();
  });

  it('GET /enrollments/:id passes the current organization', async () => {
    const res = await request(app.getHttpServer()).get('/enrollments/e-1');

    expect(res.status).toBe(200);
    expect(serviceStub.findOne).toHaveBeenCalledWith('e-1', 'org-1');
  });

  it('GET /enrollments/student/:studentId passes the current organization', async () => {
    const res = await request(app.getHttpServer()).get(
      '/enrollments/student/s-1',
    );

    expect(res.status).toBe(200);
    expect(serviceStub.findByStudent).toHaveBeenCalledWith('s-1', 'org-1');
  });

  it('GET /enrollments/class/:classId passes the current organization', async () => {
    const res = await request(app.getHttpServer()).get(
      '/enrollments/class/c-1',
    );

    expect(res.status).toBe(200);
    expect(serviceStub.findByClass).toHaveBeenCalledWith('c-1', 'org-1');
  });

  it('PATCH /enrollments/:id/status passes the current organization', async () => {
    const res = await request(app.getHttpServer())
      .patch('/enrollments/e-1/status')
      .send({ status: EnrollmentStatus.CANCELLED });

    expect(res.status).toBe(200);
    expect(serviceStub.updateStatus).toHaveBeenCalledWith(
      'e-1',
      { status: EnrollmentStatus.CANCELLED },
      'org-1',
    );
  });

  it('DELETE /enrollments/:id passes the current organization', async () => {
    const res = await request(app.getHttpServer()).delete('/enrollments/e-1');

    expect(res.status).toBe(200);
    expect(serviceStub.remove).toHaveBeenCalledWith('e-1', 'org-1');
  });
});

describe('EnrollmentsController without an organization in the JWT (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ userId: 'user-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the request user has no organization', async () => {
    const res = await request(app.getHttpServer()).get('/enrollments');

    expect(res.status).toBe(403);
    expect(serviceStub.findAll).not.toHaveBeenCalled();
  });
});
