import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { Teacher } from '../entities/teacher.entity';
import { User } from '../../users/entities/user.entity';
import { ImportParsedRow } from '../../imports/types/import.types';
import {
  TEACHER_IMPORT_EMAIL_PATTERN,
  TEACHER_IMPORT_DATE_PATTERN,
  TEACHER_IMPORT_MAX_FULL_NAME_LENGTH,
  TEACHER_IMPORT_MAX_TEACHER_CODE_LENGTH,
  TEACHER_IMPORT_MAX_SPECIALIZATION_LENGTH,
  TEACHER_IMPORT_MAX_QUALIFICATION_LENGTH,
  TEACHER_IMPORT_MAX_BIO_LENGTH,
} from './teacher-import.constants';
import {
  TeacherImportRowData,
  TeacherImportRowError,
  TeacherImportRowResult,
} from './teacher-import.types';

function errorOf(field: string, message: string): TeacherImportRowError {
  return { field, message };
}

@Injectable()
export class TeacherImportRowValidator {
  validateRows(rows: ImportParsedRow[]): TeacherImportRowResult[] {
    const teacherCodeSeen = new Map<string, TeacherImportRowResult>();
    const emailSeen = new Map<string, TeacherImportRowResult>();
    const results: TeacherImportRowResult[] = [];

    for (const row of rows) {
      const errors: TeacherImportRowError[] = [];
      const data: TeacherImportRowData = {
        email: '',
        full_name: '',
        teacher_code: '',
        specialization: null,
        qualification: null,
        bio: null,
        hire_date: null,
        branch_codes: [],
      };

      const email = this.readEmail(row.data);
      data.email = email;
      this.validateEmail(email, errors);

      const fullName = this.readString(row.data['full_name']);
      data.full_name = fullName;
      this.validateFullName(fullName, errors);

      const teacherCode = this.readString(
        row.data['teacher_code'],
      ).toUpperCase();
      data.teacher_code = teacherCode;
      this.validateTeacherCode(teacherCode, errors);

      const specialization = this.readString(row.data['specialization']);
      data.specialization = specialization || null;
      this.validateOptionalLength(
        'specialization',
        'Chuyên môn',
        specialization,
        TEACHER_IMPORT_MAX_SPECIALIZATION_LENGTH,
        errors,
      );

      const qualification = this.readString(row.data['qualification']);
      data.qualification = qualification || null;
      this.validateOptionalLength(
        'qualification',
        'Bằng cấp',
        qualification,
        TEACHER_IMPORT_MAX_QUALIFICATION_LENGTH,
        errors,
      );

      const bio = this.readString(row.data['bio']);
      data.bio = bio || null;
      this.validateOptionalLength(
        'bio',
        'Giới thiệu',
        bio,
        TEACHER_IMPORT_MAX_BIO_LENGTH,
        errors,
      );

      if (this.hasValue(row.data['hire_date'])) {
        const hireDate = this.normalizeDate(row.data['hire_date']);

        if (hireDate) {
          data.hire_date = hireDate;
        } else {
          errors.push(errorOf('hire_date', 'Ngày tuyển dụng không hợp lệ'));
        }
      }

      const branchCodes = this.parseBranchCodes(row.data['branch_codes']);
      this.validateBranchCodes(branchCodes, errors);
      data.branch_codes = [...new Set(branchCodes)];

      const result: TeacherImportRowResult = {
        rowNumber: row.rowNumber,
        status: 'VALID',
        data,
        errors,
      };

      this.detectDuplicateTeacherCode(teacherCode, teacherCodeSeen, result);
      this.detectDuplicateEmail(email, emailSeen, result);

      result.status = errors.length === 0 ? 'VALID' : 'INVALID';
      results.push(result);
    }

    return results;
  }

  private validateEmail(email: string, errors: TeacherImportRowError[]): void {
    if (!email) {
      errors.push(errorOf('email', 'Email là bắt buộc'));
      return;
    }

    if (!TEACHER_IMPORT_EMAIL_PATTERN.test(email)) {
      errors.push(errorOf('email', 'Email phải có đuôi @gmail.com'));
    }
  }

  private validateFullName(
    fullName: string,
    errors: TeacherImportRowError[],
  ): void {
    if (!fullName) {
      errors.push(errorOf('full_name', 'Họ và tên là bắt buộc'));
      return;
    }

    if (fullName.length > TEACHER_IMPORT_MAX_FULL_NAME_LENGTH) {
      errors.push(
        errorOf(
          'full_name',
          `Họ và tên vượt quá ${TEACHER_IMPORT_MAX_FULL_NAME_LENGTH} ký tự`,
        ),
      );
    }
  }

  private validateTeacherCode(
    teacherCode: string,
    errors: TeacherImportRowError[],
  ): void {
    if (!teacherCode) {
      errors.push(errorOf('teacher_code', 'Mã giáo viên là bắt buộc'));
      return;
    }

    if (teacherCode.length > TEACHER_IMPORT_MAX_TEACHER_CODE_LENGTH) {
      errors.push(
        errorOf(
          'teacher_code',
          `Mã giáo viên vượt quá ${TEACHER_IMPORT_MAX_TEACHER_CODE_LENGTH} ký tự`,
        ),
      );
    }
  }

  private validateOptionalLength(
    field: string,
    label: string,
    value: string,
    maxLength: number,
    errors: TeacherImportRowError[],
  ): void {
    if (value && value.length > maxLength) {
      errors.push(errorOf(field, `${label} vượt quá ${maxLength} ký tự`));
    }
  }

  private validateBranchCodes(
    branchCodes: string[],
    errors: TeacherImportRowError[],
  ): void {
    if (branchCodes.length === 0) {
      errors.push(errorOf('branch_codes', 'Ít nhất một chi nhánh là bắt buộc'));
      return;
    }

    const seen = new Set<string>();
    for (const code of branchCodes) {
      if (seen.has(code)) {
        errors.push(
          errorOf(
            'branch_codes',
            `Mã chi nhánh "${code}" bị lặp trong cùng dòng`,
          ),
        );
      }
      seen.add(code);
    }
  }

  private detectDuplicateTeacherCode(
    teacherCode: string,
    seen: Map<string, TeacherImportRowResult>,
    result: TeacherImportRowResult,
  ): void {
    if (!teacherCode) {
      return;
    }

    const previous = seen.get(teacherCode);

    if (previous !== undefined) {
      const message = `Mã giáo viên "${teacherCode}" bị trùng lặp trong file`;
      result.errors.push(errorOf('teacher_code', message));
      result.status = 'INVALID';
      previous.errors.push(errorOf('teacher_code', message));
      previous.status = 'INVALID';
      return;
    }

    seen.set(teacherCode, result);
  }

  private detectDuplicateEmail(
    email: string,
    seen: Map<string, TeacherImportRowResult>,
    result: TeacherImportRowResult,
  ): void {
    if (!email) {
      return;
    }

    const previous = seen.get(email);

    if (previous !== undefined) {
      const message = `Email "${email}" bị trùng lặp trong file`;
      result.errors.push(errorOf('email', message));
      result.status = 'INVALID';
      previous.errors.push(errorOf('email', message));
      previous.status = 'INVALID';
      return;
    }

    seen.set(email, result);
  }

  private parseBranchCodes(raw: unknown): string[] {
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return [String(raw).trim()].filter((item) => item !== '');
    }

    return [];
  }

  private hasValue(raw: unknown): boolean {
    return raw !== null && raw !== undefined && raw !== '';
  }

  private readEmail(data: Record<string, unknown>): string {
    return this.readString(data['email']).toLowerCase();
  }

  private readString(raw: unknown): string {
    if (typeof raw === 'string') {
      return raw.trim();
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw).trim();
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
      const match = TEACHER_IMPORT_DATE_PATTERN.exec(value);

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

@Injectable()
export class TeacherImportBusinessValidator {
  constructor(
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async addBusinessErrors(
    results: TeacherImportRowResult[],
    organizationId: string,
  ): Promise<void> {
    const teacherCodes = new Set<string>();
    const emails = new Set<string>();
    const branchCodes = new Set<string>();

    for (const result of results) {
      if (result.data.teacher_code) {
        teacherCodes.add(result.data.teacher_code);
      }
      if (result.data.email) {
        emails.add(result.data.email.toLowerCase());
      }
      for (const code of result.data.branch_codes) {
        branchCodes.add(code);
      }
    }

    const teacherCodeList = [...teacherCodes];
    const emailList = [...emails];
    const branchCodeList = [...branchCodes];

    const existingTeachers =
      teacherCodeList.length > 0
        ? await this.teachersRepository.find({
            where: { organizationId, teacherCode: In(teacherCodeList) },
          })
        : [];
    const existingUsers =
      emailList.length > 0
        ? await this.usersRepository.find({
            where: { email: In(emailList) },
          })
        : [];
    const branches =
      branchCodeList.length > 0
        ? await this.branchesRepository.find({
            where: { organizationId, code: In(branchCodeList) },
          })
        : [];

    const existingTeacherCodes = new Set(
      existingTeachers.map((teacher) => teacher.teacherCode),
    );
    const existingEmails = new Set(
      existingUsers.map((user) => user.email.toLowerCase()),
    );
    const branchMap = new Map(branches.map((branch) => [branch.code, branch]));

    for (const result of results) {
      if (
        result.data.teacher_code &&
        existingTeacherCodes.has(result.data.teacher_code)
      ) {
        result.errors.push({
          field: 'teacher_code',
          message: 'Mã giáo viên đã tồn tại',
        });
      }

      if (
        result.data.email &&
        existingEmails.has(result.data.email.toLowerCase())
      ) {
        result.errors.push({
          field: 'email',
          message: 'Email đã được sử dụng',
        });
      }

      for (const code of result.data.branch_codes) {
        const branch = branchMap.get(code);

        if (!branch) {
          result.errors.push({
            field: 'branch_codes',
            message: `Mã chi nhánh "${code}" không tồn tại trong tổ chức`,
          });
        } else if (branch.status !== BranchStatus.ACTIVE) {
          result.errors.push({
            field: 'branch_codes',
            message: `Chi nhánh "${code}" hiện đang ngừng hoạt động`,
          });
        }
      }

      result.status = result.errors.length === 0 ? 'VALID' : 'INVALID';
    }
  }
}
