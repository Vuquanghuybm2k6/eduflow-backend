import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { ImportRowResult } from '../types/import.types';

@Injectable()
export class ImportBusinessValidator {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async addBusinessErrors(
    results: ImportRowResult[],
    organizationId: string,
  ): Promise<void> {
    const branchCodes = this.collect(results, 'branch_code');
    const studentCodes = this.collect(results, 'student_code');
    const emails = this.collectEmails(results);

    let branches: Branch[] = [];
    let students: Student[] = [];
    let users: User[] = [];

    if (branchCodes.length > 0) {
      branches = await this.branchesRepository.find({
        where: { organizationId, code: In(branchCodes) },
      });
    }

    if (studentCodes.length > 0) {
      students = await this.studentsRepository.find({
        where: { organizationId, studentCode: In(studentCodes) },
      });
    }

    if (emails.length > 0) {
      users = await this.usersRepository.find({
        where: { email: In(emails) },
      });
    }

    const branchMap = new Map(branches.map((branch) => [branch.code, branch]));
    const existingStudentCodes = new Set(
      students.map((student) => student.studentCode),
    );
    const existingEmails = new Set(
      users.map((user) => user.email.toLowerCase()),
    );

    for (const result of results) {
      const branchCode = this.stringValue(result.values['branch_code']);
      const studentCode = this.stringValue(result.values['student_code']);
      const email = this.stringValue(result.values['email']).toLowerCase();

      if (branchCode) {
        const branch = branchMap.get(branchCode);

        if (!branch) {
          result.errors.push({
            rowNumber: result.rowNumber,
            field: 'branch_code',
            message: 'Mã chi nhánh không tồn tại trong tổ chức',
          });
        } else if (branch.status !== BranchStatus.ACTIVE) {
          result.errors.push({
            rowNumber: result.rowNumber,
            field: 'branch_code',
            message: 'Chi nhánh hiện đang ngừng hoạt động',
          });
        }
      }

      if (studentCode && existingStudentCodes.has(studentCode)) {
        result.errors.push({
          rowNumber: result.rowNumber,
          field: 'student_code',
          message: 'Mã học viên đã tồn tại',
        });
      }

      if (email && existingEmails.has(email)) {
        result.errors.push({
          rowNumber: result.rowNumber,
          field: 'email',
          message: 'Email đã được sử dụng',
        });
      }

      result.valid = result.errors.length === 0;
    }
  }

  private collect(results: ImportRowResult[], field: string): string[] {
    const values = new Set<string>();

    for (const result of results) {
      const value = this.stringValue(result.values[field]);
      if (value) {
        values.add(value);
      }
    }

    return [...values];
  }

  private collectEmails(results: ImportRowResult[]): string[] {
    const emails = new Set<string>();

    for (const result of results) {
      const email = this.stringValue(result.values['email']).toLowerCase();
      if (email) {
        emails.add(email);
      }
    }

    return [...emails];
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
