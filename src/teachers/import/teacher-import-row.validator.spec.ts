import { Test, TestingModule } from '@nestjs/testing';

import { ImportParsedRow } from '../../imports/types/import.types';
import { TeacherImportRowValidator } from './teacher-import.validator';

function row(
  rowNumber: number,
  data: Record<string, unknown>,
): ImportParsedRow {
  return { rowNumber, data };
}

describe('TeacherImportRowValidator', () => {
  let validator: TeacherImportRowValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeacherImportRowValidator],
    }).compile();

    validator = module.get(TeacherImportRowValidator);
  });

  it('marks a fully valid row as valid and normalizes values', () => {
    const results = validator.validateRows([
      row(2, {
        email: ' Teacher@Gmail.COM ',
        full_name: '  Nguyen Van A  ',
        teacher_code: ' gv001 ',
        specialization: 'Mathematics',
        qualification: 'Master',
        bio: 'Senior teacher',
        hire_date: '2025-01-10',
        branch_codes: ' BR001, BR002 ',
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('VALID');
    expect(results[0].errors).toEqual([]);
    expect(results[0].data.email).toBe('teacher@gmail.com');
    expect(results[0].data.full_name).toBe('Nguyen Van A');
    expect(results[0].data.teacher_code).toBe('GV001');
    expect(results[0].data.hire_date).toBe('2025-01-10');
    expect(results[0].data.branch_codes).toEqual(['BR001', 'BR002']);
  });

  it('accepts a single optional branch code', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('VALID');
    expect(results[0].data.branch_codes).toEqual(['BR001']);
  });

  it('rejects a row missing a required email', () => {
    const results = validator.validateRows([
      row(2, {
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('rejects a row missing full_name', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'full_name' })]),
    );
  });

  it('rejects a whitespace-only full_name', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: '   ',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'full_name' })]),
    );
  });

  it('rejects a row missing teacher_code', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'teacher_code' }),
      ]),
    );
  });

  it('rejects an invalid email', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'sai-email',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('rejects an invalid hire_date', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        hire_date: '9999-99-99',
        branch_codes: 'BR001',
      }),
      row(3, {
        email: 'b@gmail.com',
        full_name: 'Nguyen Van B',
        teacher_code: 'GV002',
        hire_date: '2025-02-30',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[1].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'hire_date' })]),
    );
  });

  it('accepts a Date instance for hire_date', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        hire_date: new Date(2025, 0, 10),
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('VALID');
    expect(results[0].data.hire_date).toBe('2025-01-10');
  });

  it('rejects missing branch_codes', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'branch_codes' }),
      ]),
    );
  });

  it('rejects a duplicated branch code inside the same row', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001, BR002, BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors[0].field).toBe('branch_codes');
    expect(results[0].errors[0].message).toContain('BR001');
    expect(results[0].data.branch_codes).toEqual(['BR001', 'BR002']);
  });

  it('rejects a full_name longer than 150 characters', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'X'.repeat(151),
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'full_name' })]),
    );
  });

  it('rejects a teacher_code longer than 50 characters', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'X'.repeat(51),
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'teacher_code' }),
      ]),
    );
  });

  it('rejects an over-long optional field', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        specialization: 'X'.repeat(101),
        qualification: 'X'.repeat(101),
        bio: 'X'.repeat(2001),
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    for (const field of ['specialization', 'qualification', 'bio']) {
      expect(results[0].errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    }
  });

  it('detects a duplicate teacher_code inside the same file', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'gv001',
        branch_codes: 'BR001',
      }),
      row(4, {
        email: 'b@gmail.com',
        full_name: 'Nguyen Van B',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[1].status).toBe('INVALID');
    expect(results[0].errors).toHaveLength(1);
    expect(results[1].errors).toHaveLength(1);
    expect(results[0].errors[0].field).toBe('teacher_code');
    expect(results[1].errors[0].field).toBe('teacher_code');
    expect(results[0].errors[0].message).toContain('trùng lặp');
    expect(results[1].errors[0].message).toContain('trùng lặp');
  });

  it('detects a duplicate email inside the same file case-insensitively', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
      row(3, {
        email: ' A@GMAIL.COM ',
        full_name: 'Nguyen Van B',
        teacher_code: 'GV002',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('INVALID');
    expect(results[1].status).toBe('INVALID');
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
    expect(results[1].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('keeps the real excel row numbers', () => {
    const results = validator.validateRows([
      row(12, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].rowNumber).toBe(12);
  });

  it('leaves optional fields as null when blank', () => {
    const results = validator.validateRows([
      row(2, {
        email: 'a@gmail.com',
        full_name: 'Nguyen Van A',
        teacher_code: 'GV001',
        branch_codes: 'BR001',
      }),
    ]);

    expect(results[0].status).toBe('VALID');
    expect(results[0].data.specialization).toBeNull();
    expect(results[0].data.qualification).toBeNull();
    expect(results[0].data.bio).toBeNull();
    expect(results[0].data.hire_date).toBeNull();
  });
});
