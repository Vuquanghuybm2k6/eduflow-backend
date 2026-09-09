import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Student } from '../entities/student.entity';
import { Gender, User } from '../../users/entities/user.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import {
  ImportJobRow,
  ImportJobRowStatus,
} from '../../imports/entities/import-job-row.entity';
import { StudentImportExecutor } from './student-import.executor';

function makeRow(
  overrides: Partial<ImportJobRow> = {},
): Partial<ImportJobRow> & { normalizedData: Record<string, unknown> } {
  return {
    id: 'row-1',
    importJobId: 'job-1',
    rowNumber: 2,
    status: ImportJobRowStatus.PENDING,
    normalizedData: {
      student_code: 'ST001',
      full_name: 'Nguyen Van A',
      email: 'a@gmail.com',
      phone: '0901234567',
      date_of_birth: '2006-01-01',
      gender: 'MALE',
      branch_code: 'HN01',
    },
    ...overrides,
  };
}

describe('StudentImportExecutor', () => {
  let executor: StudentImportExecutor;
  let branchesRepository: { findOne: jest.Mock };
  let studentsRepository: { findOne: jest.Mock };
  let usersRepository: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  function txManager() {
    return {
      save: jest
        .fn()
        .mockImplementation((arg) => Promise.resolve({ ...arg, id: 'new-id' })),
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((arg) => arg),
    };
  }

  beforeEach(async () => {
    branchesRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'branch-1',
        code: 'HN01',
        organizationId: 'org-1',
        status: BranchStatus.ACTIVE,
      }),
    };
    studentsRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    usersRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation((fn) => fn(txManager())),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentImportExecutor,
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
        { provide: getRepositoryToken(Student), useValue: studentsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    executor = module.get(StudentImportExecutor);
  });

  it('creates a user, membership and student in a transaction', async () => {
    await executor.execute(makeRow() as ImportJobRow, 'org-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    const tx = txManager();
    const fnArg = dataSource.transaction.mock.calls[0][0];
    await fnArg(tx);

    const userEntity = tx.create.mock.calls[0][1];
    expect(userEntity.email).toBe('a@gmail.com');
    expect(userEntity.fullName).toBe('Nguyen Van A');
    expect(userEntity.gender).toBe(Gender.MALE);

    const membershipEntity = tx.create.mock.calls[2][1];
    expect(membershipEntity.userId).toBe('new-id');
    expect(membershipEntity.organizationId).toBe('org-1');

    const studentEntity = tx.create.mock.calls[3][1];
    expect(studentEntity.studentCode).toBe('ST001');
    expect(studentEntity.branches).toHaveLength(1);
  });

  it('reuses the existing Student role instead of creating a new one', async () => {
    const tx = txManager();
    tx.findOneBy.mockResolvedValue({
      id: 'role-student',
      name: 'Student',
      organizationId: 'org-1',
    });
    dataSource.transaction.mockImplementation((fn) => fn(tx));

    await executor.execute(makeRow() as ImportJobRow, 'org-1');

    expect(tx.findOneBy).toHaveBeenCalled();
    expect(tx.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Student', isSystem: true }),
    );
  });

  it('throws ConflictException when the student code already exists', async () => {
    studentsRepository.findOne.mockResolvedValue({
      id: 'student-1',
      studentCode: 'ST001',
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

  it('throws ConflictException when the branch is not found', async () => {
    branchesRepository.findOne.mockResolvedValue(null);

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the branch is inactive', async () => {
    branchesRepository.findOne.mockResolvedValue({
      id: 'branch-1',
      code: 'HN01',
      organizationId: 'org-1',
      status: BranchStatus.INACTIVE,
    });

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('propagates an error when the transaction rolls back', async () => {
    dataSource.transaction.mockRejectedValue(new Error('creation failed'));

    await expect(
      executor.execute(makeRow() as ImportJobRow, 'org-1'),
    ).rejects.toThrow('creation failed');
  });
});
