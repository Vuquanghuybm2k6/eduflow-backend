import { Injectable } from '@nestjs/common';

import { StudentGender } from '../../students/entities/student.entity';
import {
  ImportParsedRow,
  ImportRowError,
  ImportRowResult,
} from '../types/import.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-() ]{6,20}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function errorOf(
  rowNumber: number,
  field: string,
  message: string,
): ImportRowError {
  return { rowNumber, field, message };
}

@Injectable()
export class ImportRowValidator {
  validateRows(rows: ImportParsedRow[]): ImportRowResult[] {
    const studentCodeSeen = new Map<string, number>();
    const emailSeen = new Map<string, string>();
    const results: ImportRowResult[] = [];

    for (const row of rows) {
      const errors: ImportRowError[] = [];
      const values: Record<string, unknown> = {};

      const studentCode = this.readString(row.data, 'student_code');
      if (studentCode) {
        values['student_code'] = studentCode;
      }
      this.validateStudentCode(studentCode, row.rowNumber, errors);

      const fullName = this.readString(row.data, 'full_name');
      if (fullName) {
        values['full_name'] = fullName;
      }
      this.validateFullName(fullName, row.rowNumber, errors);

      const email = this.readEmail(row.data);
      if (email) {
        values['email'] = email;
      }
      this.validateEmail(email, row.rowNumber, errors);

      this.validatePhone(row.data, row.rowNumber, values, errors);
      this.validateDateOfBirth(row.data, row.rowNumber, values, errors);
      this.validateGender(row.data, row.rowNumber, values, errors);

      const branchCode = this.readString(row.data, 'branch_code');
      if (branchCode) {
        values['branch_code'] = branchCode;
      } else {
        errors.push(
          errorOf(row.rowNumber, 'branch_code', 'Mã chi nhánh là bắt buộc'),
        );
      }

      this.detectDuplicateStudentCode(
        studentCode,
        row.rowNumber,
        studentCodeSeen,
        errors,
      );
      this.detectDuplicateEmail(email, row.rowNumber, emailSeen, errors);

      results.push({
        rowNumber: row.rowNumber,
        values,
        valid: errors.length === 0,
        errors,
      });
    }

    return results;
  }

  private validateStudentCode(
    value: string,
    rowNumber: number,
    errors: ImportRowError[],
  ): void {
    if (!value) {
      errors.push(
        errorOf(rowNumber, 'student_code', 'Mã học viên là bắt buộc'),
      );
      return;
    }

    if (value.length > 50) {
      errors.push(
        errorOf(rowNumber, 'student_code', 'Mã học viên vượt quá 50 ký tự'),
      );
    }
  }

  private validateFullName(
    value: string,
    rowNumber: number,
    errors: ImportRowError[],
  ): void {
    if (!value) {
      errors.push(errorOf(rowNumber, 'full_name', 'Họ và tên là bắt buộc'));
      return;
    }

    if (value.length > 150) {
      errors.push(
        errorOf(rowNumber, 'full_name', 'Họ và tên vượt quá 150 ký tự'),
      );
    }
  }

  private validateEmail(
    value: string,
    rowNumber: number,
    errors: ImportRowError[],
  ): void {
    if (!value) {
      errors.push(errorOf(rowNumber, 'email', 'Email là bắt buộc'));
      return;
    }

    if (!EMAIL_PATTERN.test(value)) {
      errors.push(errorOf(rowNumber, 'email', 'Email không hợp lệ'));
    }
  }

  private validatePhone(
    data: Record<string, unknown>,
    rowNumber: number,
    values: Record<string, unknown>,
    errors: ImportRowError[],
  ): void {
    const rawPhone = this.readString(data, 'phone');

    if (!rawPhone) {
      return;
    }

    // Excel thường bỏ số 0 đầu khi nhập số điện thoại dạng số → tự bổ sung
    const phone = rawPhone.startsWith('0') ? rawPhone : `0${rawPhone}`;
    values['phone'] = phone;

    if (!PHONE_PATTERN.test(phone)) {
      errors.push(errorOf(rowNumber, 'phone', 'Số điện thoại không hợp lệ'));
    }
  }

  private validateDateOfBirth(
    data: Record<string, unknown>,
    rowNumber: number,
    values: Record<string, unknown>,
    errors: ImportRowError[],
  ): void {
    const raw = data['date_of_birth'];

    if (raw === null || raw === undefined || raw === '') {
      return;
    }

    const normalized = this.normalizeDate(raw);

    if (normalized) {
      values['date_of_birth'] = normalized;
    } else {
      errors.push(
        errorOf(rowNumber, 'date_of_birth', 'Ngày sinh không hợp lệ'),
      );
    }
  }

  private validateGender(
    data: Record<string, unknown>,
    rowNumber: number,
    values: Record<string, unknown>,
    errors: ImportRowError[],
  ): void {
    const raw = data['gender'];

    if (raw === null || raw === undefined || raw === '') {
      return;
    }

    let normalized: string;

    if (typeof raw === 'string') {
      normalized = raw.trim().toUpperCase();
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      normalized = String(raw).trim().toUpperCase();
    } else {
      errors.push(errorOf(rowNumber, 'gender', 'Giới tính không hợp lệ'));
      return;
    }

    const knownGenders = Object.values(StudentGender) as string[];

    if (!knownGenders.includes(normalized)) {
      errors.push(errorOf(rowNumber, 'gender', 'Giới tính không hợp lệ'));
      return;
    }

    values['gender'] = normalized;
  }

  private detectDuplicateStudentCode(
    studentCode: string,
    rowNumber: number,
    seen: Map<string, number>,
    errors: ImportRowError[],
  ): void {
    if (!studentCode) {
      return;
    }

    const previous = seen.get(studentCode);

    if (previous !== undefined) {
      errors.push(
        errorOf(
          rowNumber,
          'student_code',
          `Mã học viên "${studentCode}" bị trùng lặp trong file`,
        ),
      );
      return;
    }

    seen.set(studentCode, rowNumber);
  }

  private detectDuplicateEmail(
    email: string,
    rowNumber: number,
    seen: Map<string, string>,
    errors: ImportRowError[],
  ): void {
    if (!email) {
      return;
    }

    const previous = seen.get(email);

    if (previous !== undefined) {
      errors.push(
        errorOf(rowNumber, 'email', `Email "${email}" bị trùng lặp trong file`),
      );
      return;
    }

    seen.set(email, email);
  }

  private readString(data: Record<string, unknown>, field: string): string {
    const raw = data[field];

    if (typeof raw === 'string') {
      return raw.trim();
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw).trim();
    }

    return '';
  }

  private readEmail(data: Record<string, unknown>): string {
    const raw = data['email'];

    if (typeof raw === 'string') {
      return raw.trim().toLowerCase();
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw).trim().toLowerCase();
    }

    return '';
  }

  private normalizeDate(raw: unknown): string | null {
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) {
        return null;
      }

      const year = raw.getFullYear();
      const month = String(raw.getMonth() + 1).padStart(2, '0');
      const day = String(raw.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }

    if (typeof raw === 'string') {
      const value = raw.trim();
      const match = DATE_PATTERN.exec(value);

      if (!match) {
        return null;
      }

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));

      const isValid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

      return isValid ? value : null;
    }

    return null;
  }
}
