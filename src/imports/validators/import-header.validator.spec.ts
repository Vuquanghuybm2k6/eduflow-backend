import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ImportHeaderValidator } from './import-header.validator';

const EXPECTED_HEADERS = [
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
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
    ];

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).not.toThrow();
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

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).not.toThrow();
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

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).not.toThrow();
  });

  it('rejects a missing required header', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
    ];

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).toThrow(
      BadRequestException,
    );
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

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unexpected header', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
      'abc',
    ];

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).toThrow(
      BadRequestException,
    );
  });

  it('ignores empty trailing header cells', () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'branch_code',
      '',
      '',
    ];

    expect(() => validator.validate(headers, EXPECTED_HEADERS)).not.toThrow();
  });
});