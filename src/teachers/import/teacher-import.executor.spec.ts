import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Teacher } from '../entities/teacher.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import {
  ImportJobRow,
  ImportJobRowStatus,
} from '../../imports/entities/import-job-row.entity';
import { TeacherImportExecutor } from './teacher-import.executor';

function makeRow(
  overrides: Partial<ImportJobRow> = {},
): Partial<ImportJobRow> & { normalizedData: Record<string, unknown> } {
  return {
    id: 'row-1',
    importJobId: 'job-1',
    rowNumber: 2,
    status: ImportJobRowStatus.PENDING,
    normalizedData: {
      email: 'a@gmail.com',
      full_name: 'Nguyen Van A',
      teacher_code: 'GV001',
      specialization: 'Mathematics',
      qualification: 'Master',
      bio: 'Example bio',
      hire_date: '2025-01-10',
      gender: 'FEMALE',
      branch_codes: ['HN01', 'HN02'],
    },
    ...overrides,
  };
}

describe('TeacherImportExecutor', () => {
  let executor: TeacherImportExecutor;
  let teachersRepository: { findOne: jest.Mock };
  let usersRepository: { findOne: jest.Mock };
  let branchesRepository: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  function txManager() {
    return {
      save: jest
        .fn()
        .mockImplementation((arg) => Promise.resolve({ ...arg, id: 'new-id' })),
      findOneBy: jest.fn().mockResolvedValue(null),
      findBy: jest.fn().mockResolvedValue([
        {
          id: 'branch-1',
          code: 'HN01',
          organizationId: 'org-1',
          status: BranchStatus.ACTIVE,
        },
        {
          id: 'branch-2',
          code: 'HN02',
          organizationId: 'org-1',
          status: BranchStatus.ACTIVE,
        },
      ]),
      create: jest.fn().mockImplementation((arg) => arg),
    };
  }

  beforeEach(async () => {
    teachersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    usersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    branchesRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'branch-1',
          code: 'HN01',
          organizationId: 'org-1',
          status: BranchStatus.ACTIVE,
        },
        {
          id: 'branch-2',
          code: 'HN02',
          organizationId: 'org-1',
          status: BranchStatus.ACTIVE,
        },
      ]),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((fn) => fn(txManager())),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherImportExecutor,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: getRepositoryToken(Teacher), useValue: teachersRepository },
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
        { provide: getRepositoryToken(Membership), useValue: {} },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    executor = module.get(TeacherImportExecutor);
  });

  it('creates a user, membership, teacher and teacher branches in one transaction', async () => {
    await executor.execute(makeRow() as ImportJobRow, 'org-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    const tx = txManager();
    const fnArg = dataSource.transaction.mock.calls[0][0];
    await fnArg(tx);

    const userEntity = tx.create.mock.calls[0][1];
    expect(userEntity.email).toBe('a@gmail.com');
    expect(userEntity.fullName).toBe('Nguyen Van A');
    expect(userEntity.phone).toBeNull();
    expect(userEntity.gender).toBe('FEMALE');

    const membershipEntity = tx.create.mock.calls[2][1];
    expect(membershipEntity.userId).toBe('new-id');
    expect(membershipEntity.organizationId).toBe('org-1');
    expect(membershipEntity.roleId).toBe('new-id');

    const teacherEntity = tx.create.mock.calls[3][1];
    expect(teacherEntity.teacherCode).toBe('GV001');
    expect(teacherEntity.specialization).toBe('Mathematics');
    expect(teacherEntity.qualification).toBe('Master');
    expect(teacherEntity.bio).toBe('Example bio');
    expect(teacherEntity.hireDate).toEqual(new Date('2025-01-10'));
    expect(teacherEntity.branches).toHaveLength(2);
    expect(teacherEntity.branches.map((b: Branch) => b.id)).toEqual([
      'branch-1',
      'branch-2',
    ]);
  });

  it('assigns the TEACHER role to the membership', async () => {
    const tx = txManager();
    tx.findOneBy.mockResolvedValue({
      id: 'role-teacher',
      name: 'Teacher',
      organizationId: 'org-1',
      isSystem: true,
    });
    dataSource.transaction.mockImplementation((fn) => fn(tx));

    await executor.execute(makeRow() as ImportJobRow, 'org-1');

    expect(tx.findOneBy).toHaveBeenCalled();
    expect(tx.create.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        roleId: 'role-teacher',
        organizationId: 'org-1',
      }),
    );
  });

  it('assigns a null gender when the row has no gender', async () => {
    const tx = txManager();
    dataSource.transaction.mockImplementation((fn) => fn(tx));

    await executor.execute(
      makeRow({
        normalizedData: { ...makeRow().normalizedData, gender: null },
      }) as ImportJobRow,
      'org-1',
    );

    const userEntity = tx.create.mock.calls[0][1];
    expect(userEntity.gender).toBeNull();
  });

  it('throws ConflictException when the teacher code already exists', async () => {
    teachersRepository.findOne.mockResolvedValue({
      id: 'teacher-1',
      teacherCode: 'GV001',
    });

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the email already exists', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'a@gmail.com',
    });

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a branch is not found in the organization', async () => {
    branchesRepository.find.mockResolvedValue([
      {
        id: 'branch-1',
        code: 'HN01',
        organizationId: 'org-1',
        status: BranchStatus.ACTIVE,
      },
    ]);

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a branch is inactive', async () => {
    branchesRepository.find.mockResolvedValue([
      {
        id: 'branch-1',
        code: 'HN01',
        organizationId: 'org-1',
        status: BranchStatus.ACTIVE,
      },
      {
        id: 'branch-2',
        code: 'HN02',
        organizationId: 'org-1',
        status: BranchStatus.INACTIVE,
      },
    ]);

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('rolls the whole row back when the transaction fails', async () => {
    dataSource.transaction.mockRejectedValue(new Error('creation failed'));

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow('creation failed');
  });

  it('requires at least one branch inside the transaction', async () => {
    const tx = txManager();
    tx.findBy.mockResolvedValue([]);
    dataSource.transaction.mockImplementation((fn) => fn(tx));

    await expect(
      executor.execute(
        makeRow({
          normalizedData: { ...makeRow().normalizedData, branch_codes: [] },
        }) as ImportJobRow,
        'org-1',
      ),
    ).rejects.toThrow(ConflictException);
  });
});
