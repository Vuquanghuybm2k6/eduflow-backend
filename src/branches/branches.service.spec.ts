import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Branch, BranchStatus } from './entities/branch.entity';
import { Class } from '../classes/entities/class.entity';

describe('BranchesService', () => {
  let service: BranchesService;

  const branchRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };

  const classQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };

  const classesRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(classQueryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: getRepositoryToken(Branch),
          useValue: branchRepository,
        },
        {
          provide: getRepositoryToken(Class),
          useValue: classesRepository,
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a branch in the current organization', async () => {
      const branch = {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'Branch',
        code: 'BR-1',
        status: BranchStatus.ACTIVE,
      } as Branch;

      branchRepository.findOneBy.mockResolvedValue(null);
      branchRepository.create.mockReturnValue(branch);
      branchRepository.save.mockResolvedValue(branch);

      const result = await service.create(
        { name: 'Branch', code: 'BR-1' },
        'org-1',
      );

      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        organizationId: 'org-1',
        code: 'BR-1',
      });
      expect(branchRepository.create).toHaveBeenCalledWith({
        name: 'Branch',
        code: 'BR-1',
        organizationId: 'org-1',
      });
      expect(result).toEqual(branch);
    });

    it('throws ConflictException when branch code already exists in org', async () => {
      branchRepository.findOneBy.mockResolvedValue({
        id: 'branch-x',
        organizationId: 'org-1',
        code: 'BR-1',
      });

      await expect(
        service.create({ name: 'Branch', code: 'BR-1' }, 'org-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not reuse a branch code from another organization', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);
      branchRepository.create.mockReturnValue({ id: 'branch-1' });
      branchRepository.save.mockResolvedValue({ id: 'branch-1' });

      await service.create({ name: 'Branch', code: 'BR-1' }, 'org-2');

      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        organizationId: 'org-2',
        code: 'BR-1',
      });
    });
  });

  describe('findAll', () => {
    it('lists only branches belonging to the current organization', async () => {
      const branches = [
        { id: 'branch-1', organizationId: 'org-1' },
      ] as Branch[];
      branchRepository.find.mockResolvedValue(branches);

      const result = await service.findAll('org-1');

      expect(branchRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(branches);
    });
  });

  describe('findOne', () => {
    it('returns the branch when it exists in the organization', async () => {
      const branch = { id: 'branch-1', organizationId: 'org-1' } as Branch;
      branchRepository.findOneBy.mockResolvedValue(branch);

      const result = await service.findOne('branch-1', 'org-1');

      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-1',
        organizationId: 'org-1',
      });
      expect(result).toEqual(branch);
    });

    it('throws NotFoundException when branch does not exist in org', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('branch-x', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-x',
        organizationId: 'org-1',
      });
    });

    it('throws NotFoundException when the branch belongs to another organization', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('branch-1', 'org-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-1',
        organizationId: 'org-2',
      });
    });
  });

  describe('update', () => {
    it('updates a branch inside the current organization', async () => {
      const branch = {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'Branch',
        code: 'BR-1',
      } as Branch;
      branchRepository.findOneBy.mockResolvedValue(branch);
      branchRepository.save.mockImplementation((entity: Branch) =>
        Promise.resolve(entity),
      );

      const result = await service.update(
        'branch-1',
        { name: 'Branch renamed' },
        'org-1',
      );

      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-1',
        organizationId: 'org-1',
      });
      expect(branchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'branch-1',
          name: 'Branch renamed',
          organizationId: 'org-1',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'branch-1', name: 'Branch renamed' }),
      );
    });

    it('throws NotFoundException when branch is not in the organization', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('branch-1', { name: 'Renamed' }, 'org-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(branchRepository.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the new code is already taken in org', async () => {
      branchRepository.findOneBy
        .mockResolvedValueOnce({
          id: 'branch-1',
          organizationId: 'org-1',
          code: 'BR-1',
        })
        .mockResolvedValueOnce({
          id: 'branch-2',
          organizationId: 'org-1',
          code: 'BR-2',
        });

      await expect(
        service.update('branch-1', { code: 'BR-2' }, 'org-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(branchRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft deletes an existing branch by setting status to INACTIVE', async () => {
      const branch = { id: 'branch-1', organizationId: 'org-1' } as Branch;
      branchRepository.findOneBy.mockResolvedValue(branch);
      classQueryBuilder.getCount.mockResolvedValue(0);
      branchRepository.save.mockResolvedValue({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });

      const result = await service.remove('branch-1', 'org-1');

      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-1',
        organizationId: 'org-1',
      });
      expect(classQueryBuilder.getCount).toHaveBeenCalled();
      expect(branchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'branch-1',
          organizationId: 'org-1',
          status: BranchStatus.INACTIVE,
        }),
      );
      expect(result).toEqual({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });
    });

    it('throws ConflictException when branch has active classes', async () => {
      const branch = { id: 'branch-1', organizationId: 'org-1' } as Branch;
      branchRepository.findOneBy.mockResolvedValue(branch);
      classQueryBuilder.getCount.mockResolvedValue(2);

      await expect(service.remove('branch-1', 'org-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(branchRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the branch belongs to another organization', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('branch-1', 'org-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(classQueryBuilder.getCount).not.toHaveBeenCalled();
    });
  });
});
