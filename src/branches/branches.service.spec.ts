import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Branch, BranchStatus } from './entities/branch.entity';
import { Membership } from '../memberships/entities/membership.entity';
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

  const membershipQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const membershipsRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(membershipQueryBuilder),
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
          provide: getRepositoryToken(Membership),
          useValue: membershipsRepository,
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

  describe('resolveOrganizationId', () => {
    it('throws ForbiddenException when user has no active membership', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', { name: 'Branch', code: 'BR-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates a branch within the resolved organization', async () => {
      const membership = {
        organizationId: 'org-1',
      } as Partial<Membership>;
      const branch = {
        id: 'branch-1',
        organizationId: 'org-1',
        name: 'Branch',
        code: 'BR-1',
        status: BranchStatus.ACTIVE,
      } as Branch;

      membershipQueryBuilder.getOne.mockResolvedValue(membership);
      branchRepository.findOneBy.mockResolvedValue(null);
      branchRepository.create.mockReturnValue(branch);
      branchRepository.save.mockResolvedValue(branch);

      const result = await service.create('user-1', {
        name: 'Branch',
        code: 'BR-1',
      });

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
      const membership = {
        organizationId: 'org-1',
      } as Partial<Membership>;

      membershipQueryBuilder.getOne.mockResolvedValue(membership);
      branchRepository.findOneBy.mockResolvedValue({
        id: 'branch-x',
        organizationId: 'org-1',
        code: 'BR-1',
      });

      await expect(
        service.create('user-1', { name: 'Branch', code: 'BR-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when branch does not exist in org', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue({
        organizationId: 'org-1',
      });
      branchRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findOne('user-1', 'branch-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(branchRepository.findOneBy).toHaveBeenCalledWith({
        id: 'branch-x',
        organizationId: 'org-1',
      });
    });
  });

  describe('remove', () => {
    it('soft deletes an existing branch by setting status to INACTIVE', async () => {
      const branch = { id: 'branch-1' } as Branch;
      membershipQueryBuilder.getOne.mockResolvedValue({
        organizationId: 'org-1',
      });
      branchRepository.findOneBy.mockResolvedValue(branch);
      classQueryBuilder.getCount.mockResolvedValue(0);
      branchRepository.save.mockResolvedValue({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });

      const result = await service.remove('user-1', 'branch-1');

      expect(classQueryBuilder.getCount).toHaveBeenCalled();
      expect(branchRepository.save).toHaveBeenCalledWith({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });
      expect(result).toEqual({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });
    });

    it('throws ConflictException when branch has active classes', async () => {
      const branch = { id: 'branch-1' } as Branch;
      membershipQueryBuilder.getOne.mockResolvedValue({
        organizationId: 'org-1',
      });
      branchRepository.findOneBy.mockResolvedValue(branch);
      classQueryBuilder.getCount.mockResolvedValue(2);

      await expect(service.remove('user-1', 'branch-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(branchRepository.save).not.toHaveBeenCalled();
    });
  });
});
