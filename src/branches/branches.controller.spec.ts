import { Test, TestingModule } from '@nestjs/testing';
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

  it('create delegates to service with userId', async () => {
    service.create.mockResolvedValue(branch);
    await controller.create('user-1', { name: 'Branch', code: 'BR-1' });
    expect(service.create).toHaveBeenCalledWith(
      'user-1',
      { name: 'Branch', code: 'BR-1' },
      { organizationId: undefined },
    );
  });

  it('findAll delegates organizationId', async () => {
    service.findAll.mockResolvedValue([branch]);
    await controller.findAll('user-1', 'org-1');
    expect(service.findAll).toHaveBeenCalledWith('user-1', {
      organizationId: 'org-1',
    });
  });
});
