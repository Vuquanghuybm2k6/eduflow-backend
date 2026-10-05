import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch, BranchStatus } from './entities/branch.entity';

describe('BranchesController', () => {
  let controller: BranchesController;

  const branch = {
    id: 'branch-1',
    organizationId: 'org-1',
    name: 'Branch',
    code: 'BR-1',
    status: BranchStatus.ACTIVE,
  } as Branch;

  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [
        {
          provide: BranchesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /branches delegates to service.create with the current organization', async () => {
    service.create.mockResolvedValue(branch);

    await controller.create('user-1', 'org-1', {
      name: 'Branch',
      code: 'BR-1',
    });

    expect(service.create).toHaveBeenCalledWith(
      { name: 'Branch', code: 'BR-1' },
      'org-1',
    );
  });

  it('GET /branches delegates to service.findAll with the current organization', async () => {
    service.findAll.mockResolvedValue([branch]);

    await controller.findAll('user-1', 'org-1');

    expect(service.findAll).toHaveBeenCalledWith('org-1');
  });

  it('GET /branches/:id delegates to service.findOne', async () => {
    service.findOne.mockResolvedValue(branch);

    await controller.findOne('user-1', 'org-1', 'branch-1');

    expect(service.findOne).toHaveBeenCalledWith('branch-1', 'org-1');
  });

  it('PATCH /branches/:id delegates to service.update', async () => {
    service.update.mockResolvedValue(branch);

    await controller.update('user-1', 'org-1', 'branch-1', { name: 'Renamed' });

    expect(service.update).toHaveBeenCalledWith(
      'branch-1',
      { name: 'Renamed' },
      'org-1',
    );
  });

  it('DELETE /branches/:id delegates to service.remove', async () => {
    service.remove.mockResolvedValue({
      id: 'branch-1',
      status: BranchStatus.INACTIVE,
    });

    await controller.remove('user-1', 'org-1', 'branch-1');

    expect(service.remove).toHaveBeenCalledWith('branch-1', 'org-1');
  });
});

describe('BranchesController (http)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const createApp = async (
    user: { userId: string; organizationId?: string } | undefined,
  ) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [{ provide: BranchesService, useValue: service }],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.use((req, _res, next) => {
      (req as { user?: unknown }).user = user;
      next();
    });
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.init();
    return nestApp;
  };

  beforeAll(async () => {
    app = await createApp({ userId: 'user-1', organizationId: 'org-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /branches uses the organization from the JWT', async () => {
    service.findAll.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/branches');

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith('org-1');
  });

  it('GET /branches ignores an organizationId query parameter', async () => {
    service.findAll.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get(
      '/branches?organizationId=org-x',
    );

    expect(res.status).toBe(200);
    expect(service.findAll).toHaveBeenCalledWith('org-1');
  });

  it('POST /branches creates the branch inside the organization from the JWT', async () => {
    service.create.mockResolvedValue({});

    const res = await request(app.getHttpServer())
      .post('/branches')
      .send({ name: 'Branch', code: 'BR-1', organizationId: 'org-x' });

    expect(res.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();

    const ok = await request(app.getHttpServer())
      .post('/branches')
      .send({ name: 'Branch', code: 'BR-1' });

    expect(ok.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      { name: 'Branch', code: 'BR-1' },
      'org-1',
    );
  });

  it('GET /branches/:id is scoped to the organization from the JWT', async () => {
    service.findOne.mockResolvedValue({});

    const res = await request(app.getHttpServer()).get('/branches/branch-1');

    expect(res.status).toBe(200);
    expect(service.findOne).toHaveBeenCalledWith('branch-1', 'org-1');
  });

  it('returns 403 when the JWT carries no organization', async () => {
    const unauthorizedApp = await createApp({ userId: 'user-1' });

    try {
      const res = await request(unauthorizedApp.getHttpServer()).get(
        '/branches',
      );

      expect(res.status).toBe(403);
      expect(service.findAll).not.toHaveBeenCalled();
    } finally {
      await unauthorizedApp.close();
    }
  });
});
