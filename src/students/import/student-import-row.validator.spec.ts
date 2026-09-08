import { Test, TestingModule } from '@nestjs/testing';

import { ImportParsedRow } from '../../imports/types/import.types';
import { StudentImportRowValidator } from './student-import.validator';

function row(
  rowNumber: number,
  data: Record<string, unknown>,
): ImportParsedRow {
  return { rowNumber, data };
}

describe('StudentImportRowValidator', () => {
  let validator: StudentImportRowValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentImportRowValidator],
    }).compile();

    validator = module.get(StudentImportRowValidator);
  });

  it('marks a fully valid row as valid and normalizes values', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: ' ST001 ',
        full_name: 'Nguyen Van A',
        email: 'HUY@GMAIL.COM',
        phone: '0901234567',
        date_of_birth: '2006-01-01',
        gender: 'male',
        branch_code: 'HN01',
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
    expect(results[0].errors).toEqual([]);
    expect(results[0].values['student_code']).toBe('ST001');
    expect(results[0].values['email']).toBe('huy@gmail.com');
    expect(results[0].values['gender']).toBe('MALE');
  });

  it('rejects a row missing a required field', () => {
    const results = validator.validateRows([
      row(2, {
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'student_code' }),
      ]),
    );
  });

  it('rejects a whitespace-only required value', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: '   ',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'full_name' })]),
    );
  });

  it('rejects an invalid email', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'sai-email',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('rejects an email that is not a gmail address', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'invalid-email@gbgfd.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email', message: 'Email phải có đuôi @gmail.com' }),
      ]),
    );
  });

  it('accepts a gmail address case-insensitively', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'HUY@GMAIL.COM',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
  });

  it('rejects invalid dates such as 9999-99-99 and 2006-02-30', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        date_of_birth: '9999-99-99',
        branch_code: 'HN01',
      }),
      row(3, {
        student_code: 'ST002',
        full_name: 'Nguyen Van B',
        email: 'b@gmail.com',
        date_of_birth: '2006-02-30',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[1].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'date_of_birth' }),
      ]),
    );
  });

  it('rejects an invalid gender', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        gender: 'UNKNOWN',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'gender' })]),
    );
  });

  it('rejects an invalid phone', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        phone: 'abc',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
    expect(results[0].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'phone' })]),
    );
  });

  it('prepends a missing leading zero to a numeric phone', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        phone: 967368087,
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[0].errors).toEqual([]);
    expect(results[0].values['phone']).toBe('0967368087');
  });

  it('prepends a missing leading zero to a string phone', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        phone: '967368087',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[0].values['phone']).toBe('0967368087');
  });

  it('keeps a phone that already starts with a zero', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        phone: '0967368087',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[0].values['phone']).toBe('0967368087');
  });

  it('detects a duplicate student_code inside the same file', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
      row(4, {
        student_code: 'ST001',
        full_name: 'Nguyen Van B',
        email: 'b@gmail.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[1].errors).toHaveLength(1);
    expect(results[1].errors[0].field).toBe('student_code');
    expect(results[1].errors[0].message).toContain('trùng lặp');
  });

  it('detects a duplicate email inside the same file', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
      row(3, {
        student_code: 'ST002',
        full_name: 'Nguyen Van B',
        email: 'A@GMAIL.COM',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[1].valid).toBe(false);
    expect(results[1].errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('rejects a student_code longer than 50 characters', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'X'.repeat(51),
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(false);
  });

  it('keeps the real excel row numbers', () => {
    const results = validator.validateRows([
      row(12, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].rowNumber).toBe(12);
  });

  it('accepts a Date instance for date_of_birth', () => {
    const results = validator.validateRows([
      row(2, {
        student_code: 'ST001',
        full_name: 'Nguyen Van A',
        email: 'a@gmail.com',
        date_of_birth: new Date(2006, 0, 1),
        branch_code: 'HN01',
      }),
    ]);

    expect(results[0].valid).toBe(true);
    expect(results[0].values['date_of_birth']).toBe('2006-01-01');
  });
});