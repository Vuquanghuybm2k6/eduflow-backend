import { Test, TestingModule } from '@nestjs/testing';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

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
      providers: [{ provide: TeachersService, useValue: serviceStub }],
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
