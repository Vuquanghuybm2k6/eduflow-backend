import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { STUDENT_IMPORT_DEFINITION } from '../../students/import/student-import.types';
import { TEACHER_IMPORT_DEFINITION } from '../../teachers/import/teacher-import.constants';
import { ImportHeaderValidator } from './import-header.validator';

const STUDENT_HEADERS = [
  'student_code',
  'full_name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'branch_code',
];

describe('ImportHeaderValidator', () => {
  let validator: ImportHeaderValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportHeaderValidator],
    }).compile();

    validator = module.get(ImportHeaderValidator);
  });

  it('accepts the correct headers in the official order', () => {
    expect(() =>
      validator.validate(STUDENT_HEADERS, STUDENT_IMPORT_DEFINITION),
    ).not.toThrow();
  });

  it('accepts headers in any order', () => {
    const headers = [
      'email',
      'full_name',
      'student_code',
      'branch_code',
      'gender',
      'date_of_birth',
      'phone',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).not.toThrow();
  });

  it('accepts headers with surrounding whitespace and different casing', () => {
    const headers = [
      ' Student_Code ',
      'FULL_NAME',
      'Email',
      'PHONE',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).not.toThrow();
  });

  it('resolves every student Vietnamese header variant to its internal key', () => {
    const headers = [
      'Mã Học Viên',
      'Họ_và_tên',
      'EMAIL',
      'số điện thoại',
      'Ngày Sinh',
      'giới-tính',
      'MÃ CHI NHÁNH',
    ];

    const resolved = validator.validate(headers, STUDENT_IMPORT_DEFINITION);
    expect(resolved).toEqual(STUDENT_HEADERS);
  });

  it('resolves every teacher Vietnamese header variant to its internal key', () => {
    const headers = [
      'Email',
      'Họ và tên',
      'Mã Giáo Viên',
      'Chuyên môn',
      'Bằng cấp',
      'Giới thiệu',
      'Ngày tuyển dụng',
      'Giới Tính',
      'Mã chi nhánh',
    ];

    expect(
      validator.validate(headers, TEACHER_IMPORT_DEFINITION, {
        ignoreUnexpected: true,
      }),
    ).toEqual([
      'email',
      'full_name',
      'teacher_code',
      'specialization',
      'qualification',
      'bio',
      'hire_date',
      'gender',
      'branch_codes',
    ]);
  });

  it('capitalizes unexpected Vietnamese headers in the error message', () => {
    const headers = [
      'Mã học viên',
      'Họ và tên',
      'Email',
      'Số điện thoại',
      'Ngày sinh',
      'Giới tính',
      'Mã chi nhánh',
      'Tên',
      'Địa chỉ nhà',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow('Cột không hợp lệ: Tên, Địa chỉ nhà');
  });

  it('rejects a missing required header', () => {
    const headers = STUDENT_HEADERS.filter(
      (header) => header !== 'student_code',
    );

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow(BadRequestException);
  });

  it('reports the missing header with its Vietnamese label', () => {
    const headers = [
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow('Thiếu cột bắt buộc: Mã học viên');
  });

  it('rejects a duplicate header', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow(BadRequestException);
  });

  it('detects duplicates after normalization and mapping', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'Giới tính',
      'GIỚI TÍNH',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow('Cột bị lặp: Giới tính');
  });

  it('rejects an unexpected header', () => {
    const headers = [...STUDENT_HEADERS, 'abc'];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).toThrow(BadRequestException);
  });

  it('ignores unexpected headers when ignoreUnexpected is enabled', () => {
    const headers = [...STUDENT_HEADERS, 'abc'];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION, {
        ignoreUnexpected: true,
      }),
    ).not.toThrow();
  });

  it('still rejects a missing required header when ignoreUnexpected is enabled', () => {
    const headers = [
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
      'extra',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION, {
        ignoreUnexpected: true,
      }),
    ).toThrow(BadRequestException);
  });

  it('still rejects a duplicate header when ignoreUnexpected is enabled', () => {
    const headers = [
      'student_code',
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION, {
        ignoreUnexpected: true,
      }),
    ).toThrow(BadRequestException);
  });

  it('ignores an empty header column in the middle', () => {
    const headers = [
      'student_code',
      'full_name',
      '',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).not.toThrow();
  });

  it('ignores an empty header column when ignoreUnexpected is enabled', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      '',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION, {
        ignoreUnexpected: true,
      }),
    ).not.toThrow();
  });

  it('ignores empty trailing header cells', () => {
    const headers = [...STUDENT_HEADERS, '', ''];

    expect(() =>
      validator.validate(headers, STUDENT_IMPORT_DEFINITION),
    ).not.toThrow();
  });
});
