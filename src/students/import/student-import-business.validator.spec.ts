import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindManyOptions } from 'typeorm';

import { Student, StudentGender } from '../entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { ImportRowResult } from '../../imports/types/import.types';
import { StudentImportBusinessValidator } from './student-import.validator';

function result(
  rowNumber: number,
  values: Record<string, unknown>,
): ImportRowResult {
  return { rowNumber, values, valid: true, errors: [] };
}

describe('StudentImportBusinessValidator', () => {
  let validator: StudentImportBusinessValidator;
  let branchesRepository: {
    find: jest.Mock<Promise<Branch[]>, [FindManyOptions<Branch>]>;
  };
  let studentsRepository: {
    find: jest.Mock<Promise<Student[]>, [FindManyOptions<Student>]>;
  };
  let usersRepository: {
    find: jest.Mock<Promise<User[]>, [FindManyOptions<User>]>;
  };

  beforeEach(async () => {
    branchesRepository = {
      find: jest.fn<Promise<Branch[]>, [FindManyOptions<Branch>]>(),
    };
    studentsRepository = {
      find: jest.fn<Promise<Student[]>, [FindManyOptions<Student>]>(),
    };
    usersRepository = {
      find: jest.fn<Promise<User[]>, [FindManyOptions<User>]>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentImportBusinessValidator,
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
        { provide: getRepositoryToken(Student), useValue: studentsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
      ],
    }).compile();

    validator = module.get(StudentImportBusinessValidator);
  });

  describe('branch validation', () => {
    it('flags a branch that does not exist in the organization', async () => {
      branchesRepository.find.mockResolvedValue([
        Object.assign(new Branch(), {
          code: 'HN01',
          status: BranchStatus.ACTIVE,
        }),
      ]);
      studentsRepository.find.mockResolvedValue([]);
      usersRepository.find.mockResolvedValue([]);

      const results = [
        result(2, {
          student_code: 'ST001',
          full_name: 'Nguyen Van A',
          email: 'a@gmail.com',
          branch_code: 'HN01',
        }),
        result(3, {
          student_code: 'ST002',
          full_name: 'Nguyen Van B',
          email: 'b@gmail.com',
          branch_code: 'HN99',
        }),
      ];

      await validator.addBusinessErrors(results, 'org-1');

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[1].errors[0]).toEqual(
        expect.objectContaining({ field: 'branch_code' }),
      );
    });

    it('flags an inactive branch', async () => {
      branchesRepository.find.mockResolvedValue([
        Object.assign(new Branch(), {
          code: 'HN01',
          status: BranchStatus.INACTIVE,
        }),
      ]);

      const results = [result(2, { branch_code: 'HN01' })];

      await validator.addBusinessErrors(results, 'org-1');

      expect(results[0].valid).toBe(false);
      expect(results[0].errors[0].field).toBe('branch_code');
    });

    it('scopes the branch query by organizationId', async () => {
      branchesRepository.find.mockResolvedValue([]);
      studentsRepository.find.mockResolvedValue([]);
      usersRepository.find.mockResolvedValue([]);

      await validator.addBusinessErrors(
        [
          result(2, {
            branch_code: 'HN01',
            student_code: 'X',
            email: 'e@e.com',
          }),
        ],
        'org-7',
      );

      const whereArg = branchesRepository.find.mock.calls[0][0];
      expect(whereArg.where).toMatchObject({ organizationId: 'org-7' });
    });
  });

  describe('duplicate detection', () => {
    it('flags a student_code that already exists in the database', async () => {
      branchesRepository.find.mockResolvedValue([]);
      studentsRepository.find.mockResolvedValue([
        Object.assign(new Student(), {
          studentCode: 'ST001',
          gender: StudentGender.MALE,
        }),
      ]);
      usersRepository.find.mockResolvedValue([]);

      const results = [
        result(2, { student_code: 'ST001', email: 'a@gmail.com' }),
      ];

      await validator.addBusinessErrors(results, 'org-1');

      expect(results[0].valid).toBe(false);
      expect(results[0].errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'student_code' }),
        ]),
      );
    });

    it('flags an email that is already used by any user', async () => {
      branchesRepository.find.mockResolvedValue([]);
      studentsRepository.find.mockResolvedValue([]);
      usersRepository.find.mockResolvedValue([
        Object.assign(new User(), { email: 'a@gmail.com' }),
      ]);

      const results = [
        result(2, { student_code: 'ST001', email: 'A@GMAIL.COM' }),
      ];

      await validator.addBusinessErrors(results, 'org-1');

      expect(results[0].valid).toBe(false);
      expect(results[0].errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('scopes the student query by organizationId', async () => {
      branchesRepository.find.mockResolvedValue([]);
      studentsRepository.find.mockResolvedValue([]);
      usersRepository.find.mockResolvedValue([]);

      await validator.addBusinessErrors(
        [result(2, { student_code: 'ST001', email: 'e@e.com' })],
        'org-7',
      );

      const whereArg = studentsRepository.find.mock.calls[0][0];
      expect(whereArg.where).toMatchObject({ organizationId: 'org-7' });
    });
  });

  it('skips database lookups when there are no values to check', async () => {
    const results = [result(2, {})];

    await validator.addBusinessErrors(results, 'org-1');

    expect(branchesRepository.find).not.toHaveBeenCalled();
    expect(studentsRepository.find).not.toHaveBeenCalled();
    expect(usersRepository.find).not.toHaveBeenCalled();
    expect(results[0].valid).toBe(true);
  });
});