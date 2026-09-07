import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { Teacher } from '../entities/teacher.entity';
import { User } from '../../users/entities/user.entity';
import { TeacherImportRowResult } from './teacher-import.types';
import { TeacherImportBusinessValidator } from './teacher-import.validator';
import type { FindManyOptions, FindOperator } from 'typeorm';

function result(
  rowNumber: number,
  overrides: Partial<TeacherImportRowResult> = {},
): TeacherImportRowResult {
  return {
    rowNumber,
    status: 'VALID',
    data: {
      email: 'a@gmail.com',
      full_name: 'Nguyen Van A',
      teacher_code: 'GV001',
      specialization: null,
      qualification: null,
      bio: null,
      hire_date: null,
      branch_codes: ['BR001'],
    },
    errors: [],
    ...overrides,
  };
}

describe('TeacherImportBusinessValidator', () => {
  let validator: TeacherImportBusinessValidator;
  let teachersRepository: { find: jest.Mock };
  let usersRepository: { find: jest.Mock };
  let branchesRepository: { find: jest.Mock };

  beforeEach(async () => {
    teachersRepository = { find: jest.fn().mockResolvedValue([]) };
    usersRepository = { find: jest.fn().mockResolvedValue([]) };
    branchesRepository = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherImportBusinessValidator,
        { provide: getRepositoryToken(Teacher), useValue: teachersRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
      ],
    }).compile();

    validator = module.get(TeacherImportBusinessValidator);
  });

  it('keeps a row valid when nothing collides in the database', async () => {
    const results = [
      result(2, {
        data: {
          email: 'a@gmail.com',
          full_name: 'Nguyen Van A',
          teacher_code: 'GV001',
          specialization: null,
          qualification: null,
          bio: null,
          hire_date: null,
          branch_codes: ['BR001'],
        },
      }),
    ];
    branchesRepository.find.mockResolvedValue([
      { code: 'BR001', status: BranchStatus.ACTIVE },
    ]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('VALID');
    expect(results[0].errors).toEqual([]);
  });

  it('flags a teacher_code that already exists', async () => {
    const results = [result(2)];
    teachersRepository.find.mockResolvedValue([{ teacherCode: 'GV001' }]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'teacher_code' }),
      ]),
    );
  });

  it('flags an email that is already used by another user', async () => {
    const results = [result(2)];
    usersRepository.find.mockResolvedValue([{ email: 'A@GMAIL.COM' }]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('flags a branch code that does not belong to the organization', async () => {
    const results = [
      result(2, {
        data: { ...result(2).data, branch_codes: ['BR999'] },
      }),
    ];
    branchesRepository.find.mockResolvedValue([]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors[0].field).toBe('branch_codes');
    expect(results[0].errors[0].message).toContain('BR999');
  });

  it('flags an inactive branch', async () => {
    const results = [result(2)];
    branchesRepository.find.mockResolvedValue([
      { code: 'BR001', status: BranchStatus.INACTIVE },
    ]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'branch_codes' }),
      ]),
    );
  });

  it('keeps an earlier syntax error and recomputes the status', async () => {
    const results = [
      result(2, {
        status: 'INVALID',
        data: { ...result(2).data, branch_codes: ['BR999'] },
        errors: [{ field: 'email', message: 'Email là bắt buộc' }],
      }),
    ];
    branchesRepository.find.mockResolvedValue([]);

    await validator.addBusinessErrors(results, 'org-1');

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' }),
        expect.objectContaining({ field: 'branch_codes' }),
      ]),
    );
  });

  it('scopes branch lookups to the current organization', async () => {
    const results = [result(2)];

    await validator.addBusinessErrors(results, 'org-1');

    const branchCalls = branchesRepository.find.mock.calls as [
      FindManyOptions<Branch>,
    ][];
    expect(branchCalls[0][0].where).toMatchObject({ organizationId: 'org-1' });
  });

  it('queries only the distinct teacher codes, emails and branches used', async () => {
    const results = [
      result(2, {
        data: {
          ...result(2).data,
          teacher_code: 'GV001',
          email: 'a@gmail.com',
        },
      }),
      result(3, {
        data: {
          ...result(3).data,
          teacher_code: 'GV002',
          email: 'b@gmail.com',
          branch_codes: ['BR001', 'BR002'],
        },
      }),
    ];

    await validator.addBusinessErrors(results, 'org-1');

    const teacherCalls = teachersRepository.find.mock.calls as [
      FindManyOptions<Teacher>,
    ][];
    const userCalls = usersRepository.find.mock.calls as [
      FindManyOptions<User>,
    ][];
    const branchCalls = branchesRepository.find.mock.calls as [
      FindManyOptions<Branch>,
    ][];

    const teacherWhere = teacherCalls[0][0].where as Record<string, unknown>;
    const userWhere = userCalls[0][0].where as Record<string, unknown>;
    const branchWhere = branchCalls[0][0].where as Record<string, unknown>;

    const teacherCodeOperand = teacherWhere.teacherCode as FindOperator<string>;
    const emailOperand = userWhere.email as FindOperator<string>;
    const branchCodeOperand = branchWhere.code as FindOperator<string>;

    expect(teacherWhere).toMatchObject({ organizationId: 'org-1' });
    expect(teacherCodeOperand.value).toEqual(['GV001', 'GV002']);
    expect(emailOperand.value).toEqual(['a@gmail.com', 'b@gmail.com']);
    expect(branchCodeOperand.value).toEqual(['BR001', 'BR002']);
  });
});
