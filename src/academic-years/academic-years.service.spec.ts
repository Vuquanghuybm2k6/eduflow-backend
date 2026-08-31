import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import {
  AcademicYear,
  AcademicYearStatus,
} from './entities/academic-year.entity';
import { Membership } from '../memberships/entities/membership.entity';

describe('AcademicYearsService', () => {
  let service: AcademicYearsService;

  const academicYearRepository = {
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

  const manager = {
    create: jest.fn<
      AcademicYear,
      [typeof AcademicYear, Partial<AcademicYear>]
    >(),
    save: jest.fn<Promise<AcademicYear>, [AcademicYear]>(),
    createQueryBuilder: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicYearsService,
        {
          provide: getRepositoryToken(AcademicYear),
          useValue: academicYearRepository,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipsRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<AcademicYearsService>(AcademicYearsService);
  });

  const mockMembership = { organizationId: 'org-1' } as Partial<Membership>;

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveOrganizationId', () => {
    it('throws ForbiddenException when user has no active membership', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          name: '2026 - 2027',
          startDate: '2026-08-01',
          endDate: '2027-05-31',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    const dto = {
      name: '2026 - 2027',
      startDate: '2026-08-01',
      endDate: '2027-05-31',
    };

    it('creates an academic year within the resolved organization', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue(null);
      const academicYear = { id: 'ay-1', organizationId: 'org-1', ...dto };

      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      manager.createQueryBuilder.mockReturnValue(updateQb);
      manager.create.mockReturnValue(academicYear);
      manager.save.mockResolvedValue(academicYear);

      const result = await service.create('user-1', dto);

      expect(manager.create).toHaveBeenCalledWith(AcademicYear, {
        name: '2026 - 2027',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-05-31'),
        status: AcademicYearStatus.ACTIVE,
        organizationId: 'org-1',
      });
      expect(result).toEqual(academicYear);
    });

    it('throws BadRequestException when endDate is not after startDate', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);

      await expect(
        service.create('user-1', {
          name: '2026 - 2027',
          startDate: '2027-05-31',
          endDate: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException when name already exists in the org', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue({ id: 'ay-x' });

      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('completes existing active academic year when creating an active one', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue(null);

      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      manager.createQueryBuilder.mockReturnValue(updateQb);
      manager.save.mockResolvedValue({ id: 'ay-1', status: 'active' });

      await service.create('user-1', dto);

      expect(manager.createQueryBuilder).toHaveBeenCalled();
      expect(updateQb.andWhere).toHaveBeenCalledWith('status = :status', {
        status: AcademicYearStatus.ACTIVE,
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when academic year does not exist in org', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'ay-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(academicYearRepository.findOneBy).toHaveBeenCalledWith({
        id: 'ay-x',
        organizationId: 'org-1',
      });
    });
  });

  describe('update', () => {
    it('throws ConflictException when renaming to an existing name', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValueOnce({
        id: 'ay-1',
        organizationId: 'org-1',
        name: '2025 - 2026',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2026-05-31'),
        status: AcademicYearStatus.COMPLETED,
      });
      academicYearRepository.findOneBy.mockResolvedValueOnce({
        id: 'ay-2',
        organizationId: 'org-1',
        name: '2026 - 2027',
      });

      await expect(
        service.update('user-1', 'ay-1', { name: '2026 - 2027' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when new dates are invalid', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue({
        id: 'ay-1',
        organizationId: 'org-1',
        name: '2026 - 2027',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-05-31'),
      });

      await expect(
        service.update('user-1', 'ay-1', {
          startDate: '2027-05-31',
          endDate: '2026-08-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('activate', () => {
    it('throws NotFoundException when academic year does not exist', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue(null);

      await expect(service.activate('user-1', 'ay-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('activates the year and completes the previously active one', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      const academicYear = {
        id: 'ay-1',
        organizationId: 'org-1',
        status: AcademicYearStatus.INACTIVE,
      } as AcademicYear;
      academicYearRepository.findOneBy.mockResolvedValue(academicYear);

      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      manager.createQueryBuilder.mockReturnValue(updateQb);
      manager.save.mockImplementation((ay) =>
        Promise.resolve({ ...ay, status: AcademicYearStatus.ACTIVE }),
      );

      const result = await service.activate('user-1', 'ay-1');

      expect(updateQb.set).toHaveBeenCalledWith({
        status: AcademicYearStatus.COMPLETED,
      });
      expect(result.status).toBe(AcademicYearStatus.ACTIVE);
    });
  });

  describe('remove', () => {
    it('throws ConflictException when the year is ACTIVE', async () => {
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue({
        id: 'ay-1',
        organizationId: 'org-1',
        status: AcademicYearStatus.ACTIVE,
      });

      await expect(service.remove('user-1', 'ay-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('removes a non-active academic year in the org', async () => {
      const academicYear = {
        id: 'ay-1',
        organizationId: 'org-1',
        status: AcademicYearStatus.COMPLETED,
      } as AcademicYear;
      membershipQueryBuilder.getOne.mockResolvedValue(mockMembership);
      academicYearRepository.findOneBy.mockResolvedValue(academicYear);
      academicYearRepository.remove.mockResolvedValue(academicYear);

      const result = await service.remove('user-1', 'ay-1');

      expect(academicYearRepository.remove).toHaveBeenCalledWith(academicYear);
      expect(result).toEqual({ id: 'ay-1' });
    });
  });
});
