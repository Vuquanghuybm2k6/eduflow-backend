import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: { [key: string]: jest.Mock };

  const serviceStub = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: serviceStub }],
    }).compile();

    controller = module.get<CoursesController>(CoursesController);
    service = serviceStub;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /courses delegates to service.create with JWT organization context', () => {
    service.create.mockResolvedValue({ id: 'course-1' });
    const dto = { name: 'Math', code: 'MATH-101' };

    const result = controller.create('org-1', dto);

    expect(service.create).toHaveBeenCalledWith(dto, 'org-1');
    expect(result).toBeDefined();
  });

  it('GET /courses delegates to service.findAll with JWT organization context', async () => {
    await controller.findAll('org-1');

    expect(service.findAll).toHaveBeenCalledWith('org-1');
  });

  it('GET /courses/:id delegates to service.findOne', async () => {
    await controller.findOne('org-1', 'course-1');

    expect(service.findOne).toHaveBeenCalledWith('course-1', 'org-1');
  });

  it('PATCH /courses/:id delegates to service.update', async () => {
    const dto = { name: 'New name' };

    await controller.update('org-1', 'course-1', dto);

    expect(service.update).toHaveBeenCalledWith('course-1', dto, 'org-1');
  });

  it('DELETE /courses/:id delegates to service.remove', async () => {
    await controller.remove('org-1', 'course-1');

    expect(service.remove).toHaveBeenCalledWith('course-1', 'org-1');
  });
});

describe('CoursesController /courses (http)', () => {
  let app: INestApplication;

  const serviceStub = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: serviceStub }],
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
    serviceStub.create.mockResolvedValue({ id: 'course-1' });
    serviceStub.findAll.mockResolvedValue([]);
    serviceStub.findOne.mockResolvedValue({ id: 'course-1' });
    serviceStub.update.mockResolvedValue({ id: 'course-1' });
    serviceStub.remove.mockResolvedValue({ id: 'course-1' });
  });

  it('POST /courses uses the JWT organization context', async () => {
    const res = await request(app.getHttpServer())
      .post('/courses')
      .send({ name: 'Mathematics', code: 'MATH-101' });

    expect(res.status).toBe(201);
    expect(serviceStub.create).toHaveBeenCalledWith(
      { name: 'Mathematics', code: 'MATH-101' },
      'org-1',
    );
  });

  it('POST /courses rejects an organizationId inside the body with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/courses')
      .send({ name: 'Mathematics', code: 'MATH-101', organizationId: 'org-x' });

    expect(res.status).toBe(400);
    expect(serviceStub.create).not.toHaveBeenCalled();
  });

  it('GET /courses scopes to the JWT organization even when ?organizationId is sent', async () => {
    const res = await request(app.getHttpServer()).get(
      '/courses?organizationId=org-x',
    );

    expect(res.status).toBe(200);
    expect(serviceStub.findAll).toHaveBeenCalledWith('org-1');
  });

  it('GET /courses/:id passes the JWT organization context', async () => {
    const res = await request(app.getHttpServer()).get('/courses/course-1');

    expect(res.status).toBe(200);
    expect(serviceStub.findOne).toHaveBeenCalledWith('course-1', 'org-1');
  });

  it('PATCH /courses/:id passes the JWT organization context', async () => {
    const res = await request(app.getHttpServer())
      .patch('/courses/course-1')
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(serviceStub.update).toHaveBeenCalledWith(
      'course-1',
      { name: 'Updated' },
      'org-1',
    );
  });

  it('DELETE /courses/:id passes the JWT organization context', async () => {
    const res = await request(app.getHttpServer()).delete('/courses/course-1');

    expect(res.status).toBe(200);
    expect(serviceStub.remove).toHaveBeenCalledWith('course-1', 'org-1');
  });
});
