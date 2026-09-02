import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TeachersService } from './teachers.service';
import { Teacher, TeacherStatus } from './entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import { Class } from '../classes/entities/class.entity';
import { Branch } from '../branches/entities/branch.entity';

function mockQueryBuilder(getOneResult?: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getOne: jest.fn(),
  };
  Object.values(qb).forEach((fn) => {
    if (fn !== qb.getOne) {
      fn.mockReturnValue(qb);
    }
  });
  qb.getOne.mockResolvedValue(getOneResult ?? { organizationId: 'org-1' });
  return qb;
}

describe('TeachersService', () => {
  let service: TeachersService;
  let dataSource: { transaction: jest.Mock };
  let teachersRepo: Record<string, jest.Mock>;
  let usersRepo: Record<string, jest.Mock>;
  let membershipsRepo: Record<string, jest.Mock>;
  let classesRepo: Record<string, jest.Mock>;
  let branchesRepo: Record<string, jest.Mock>;

  const managerMock = () => {
    let seq = 0;
    const manager: Record<string, jest.Mock> = {
      create: jest.fn((_entity, data) => ({
        id: `id-${++seq}`,
        ...(data as object),
      })),
      save: jest.fn(async (entity: unknown) => entity),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    return manager as never;
  };

  const adminMembership = {
    id: 'm-1',
    userId: 'actor-1',
    organizationId: 'org-1',
    status: MembershipStatus.ACTIVE,
    role: { name: 'Organization Owner' },
  };

  beforeEach(async () => {
    dataSource = { transaction: jest.fn() };
    teachersRepo = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (entity: unknown) => entity),
    };
    usersRepo = {
      findOneBy: jest.fn(),
    };
    membershipsRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };
    classesRepo = {
      find: jest.fn(),
    };
    branchesRepo = {
      findBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Teacher), useValue: teachersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Class), useValue: classesRepo },
        { provide: getRepositoryToken(Branch), useValue: branchesRepo },
      ],
    }).compile();

    service = module.get<TeachersService>(TeachersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      fullName: 'Nguyen Van A',
      email: 'nguyena@gmail.com',
      teacherCode: 'GV001',
      branchIds: ['b-1'],
    };

    it('creates a User, TEACHER Membership and Teacher inside a transaction', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOneBy.mockResolvedValue(null);
      usersRepo.findOneBy.mockResolvedValue(null);
      const manager = managerMock();
      manager.findOneBy.mockResolvedValue(null);
      manager.findBy.mockResolvedValue([{ id: 'b-1', name: 'Hà Nội' }]);
      dataSource.transaction.mockImplementation(
        async (cb: (m: never) => Promise<unknown>) => cb(manager),
      );

      const result = await service.create('actor-1', dto);

      expect(dataSource.transaction).toHaveBeenCalled();
      const createdUser = manager.create.mock.calls.find(
        ([e]) => e === User,
      )?.[1];
      const createdMembership = manager.create.mock.calls.find(
        ([e]) => e === Membership,
      )?.[1];
      const createdTeacher = manager.create.mock.calls.find(
        ([e]) => e === Teacher,
      )?.[1];

      expect(createdUser).toMatchObject({
        email: 'nguyena@gmail.com',
        fullName: 'Nguyen Van A',
      });
      expect(createdMembership).toMatchObject({ organizationId: 'org-1' });
      expect(createdMembership.roleId).toBeDefined();
      expect(createdTeacher).toMatchObject({
        organizationId: 'org-1',
        teacherCode: 'GV001',
      });
      expect(createdTeacher.branches).toHaveLength(1);
      expect(createdTeacher.userId).toBeDefined();
      expect(result.teacher).toBeDefined();
      expect(result.temporaryPassword).toBeDefined();
      expect(result.temporaryPassword.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when a branch does not belong to the organization', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOneBy.mockResolvedValue(null);
      usersRepo.findOneBy.mockResolvedValue(null);
      const manager = managerMock();
      manager.findOneBy.mockResolvedValue(null);
      manager.findBy.mockResolvedValue([]);
      dataSource.transaction.mockImplementation(
        async (cb: (m: never) => Promise<unknown>) => cb(manager),
      );

      await expect(service.create('actor-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the teacher code is already used in the organization', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOneBy.mockResolvedValue({
        id: 't-1',
        teacherCode: 'GV001',
      });

      await expect(service.create('actor-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when the email already exists', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOneBy.mockResolvedValue(null);
      usersRepo.findOneBy.mockResolvedValue({
        id: 'u-1',
        email: 'nguyena@gmail.com',
      });

      await expect(service.create('actor-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when the actor is not owner/admin', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue({
        ...adminMembership,
        role: { name: 'Teacher' },
      });

      await expect(service.create('actor-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when the user has no active membership in the organization', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder(null),
      );

      await expect(service.create('actor-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('returns only teachers of the resolved organization for an admin', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.find.mockResolvedValue([
        { id: 't-1', organizationId: 'org-1', teacherCode: 'GV001' },
      ]);

      const result = await service.findAll('actor-1');

      expect(teachersRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException when called by a teacher', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue({
        ...adminMembership,
        role: { name: 'Teacher' },
      });

      await expect(service.findAll('actor-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the teacher for an admin', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOne.mockResolvedValue({
        id: 't-1',
        organizationId: 'org-1',
        teacherCode: 'GV001',
      });

      const result = await service.findOne('actor-1', 't-1');

      expect(teachersRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-1', organizationId: 'org-1' },
        }),
      );
      expect(result.teacherCode).toBe('GV001');
    });

    it('throws NotFoundException when the teacher does not exist', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('actor-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMe', () => {
    it('returns the teacher profile owned by the current user', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      teachersRepo.findOne.mockResolvedValue({
        id: 't-1',
        userId: 'user-1',
        organizationId: 'org-1',
      });

      const result = await service.findMe('user-1');

      expect(teachersRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', organizationId: 'org-1' },
        }),
      );
      expect(result.id).toBe('t-1');
    });

    it('throws NotFoundException when the user is not a teacher', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      teachersRepo.findOne.mockResolvedValue(null);

      await expect(service.findMe('user-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the teacher business fields', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      const teacher = {
        id: 't-1',
        organizationId: 'org-1',
        teacherCode: 'GV001',
        specialization: null,
        save: jest.fn(),
      };
      teachersRepo.findOne.mockResolvedValue(teacher);

      const result = await service.update('actor-1', 't-1', {
        specialization: 'Backend Development',
      });

      expect(teacher.specialization).toBe('Backend Development');
      expect(teachersRepo.save).toHaveBeenCalled();
      expect(result).toBe(teacher);
    });

    it('throws ConflictException when changing to an existing teacherCode', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      teachersRepo.findOne.mockResolvedValue({
        id: 't-1',
        organizationId: 'org-1',
        teacherCode: 'GV001',
      });
      teachersRepo.findOneBy.mockResolvedValue({
        id: 't-2',
        teacherCode: 'GV002',
      });

      await expect(
        service.update('actor-1', 't-1', { teacherCode: 'GV002' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    it('sets a legal status on the teacher', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder({ organizationId: 'org-1' }),
      );
      membershipsRepo.findOne.mockResolvedValue(adminMembership);
      const teacher = {
        id: 't-1',
        organizationId: 'org-1',
        status: TeacherStatus.ACTIVE,
      };
      teachersRepo.findOne.mockResolvedValue(teacher);

      const result = await service.updateStatus('actor-1', 't-1', {
        status: TeacherStatus.INACTIVE,
      });

      expect(teacher.status).toBe(TeacherStatus.INACTIVE);
      expect(teachersRepo.save).toHaveBeenCalled();
      expect(result).toBe(teacher);
    });
  });
});
