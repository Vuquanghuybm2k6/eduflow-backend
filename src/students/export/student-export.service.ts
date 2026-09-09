import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExcelService } from '../../common/excel/excel.service';
import { EXCEL_EXTENSION } from '../../common/excel/excel.constants';
import { Branch } from '../../branches/entities/branch.entity';
import { Student } from '../entities/student.entity';
import { StudentsService } from '../students.service';
import { ExportStudentsQueryDto } from '../dto/export-students-query.dto';
import {
  STUDENT_EXPORT_ADDRESS_COLUMN_INDEX,
  STUDENT_EXPORT_COLUMN_WIDTHS,
  STUDENT_EXPORT_HEADERS,
  STUDENT_EXPORT_SHEET_NAME,
  StudentExportResult,
  STUDENT_GENDER_LABELS,
  STUDENT_STATUS_LABELS,
} from './student-export.types';

@Injectable()
export class StudentExportService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly excelService: ExcelService,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async export(
    actorUserId: string,
    query: ExportStudentsQueryDto,
  ): Promise<StudentExportResult> {
    const organizationId = await this.studentsService.resolveOrganizationId(
      actorUserId,
      query.organizationId,
    );
    await this.studentsService.assertIsAdminOrOwner(
      actorUserId,
      organizationId,
    );

    await this.assertBranchBelongsToOrganization(
      organizationId,
      query.branchId,
    );

    const students = await this.findStudentsForExport(organizationId, query);

    const rows = students.map((student) => this.mapStudentToRow(student));

    const workbook = this.excelService.exportWorksheet({
      name: STUDENT_EXPORT_SHEET_NAME,
      headers: [...STUDENT_EXPORT_HEADERS],
      rows,
      columnWidths: [...STUDENT_EXPORT_COLUMN_WIDTHS],
      wrapColumns: [STUDENT_EXPORT_ADDRESS_COLUMN_INDEX],
    });

    const buffer = await this.excelService.writeWorkbook(workbook);

    return {
      buffer,
      filename: this.buildFilename(),
    };
  }

  private async assertBranchBelongsToOrganization(
    organizationId: string,
    branchId?: string,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.branchesRepository.findOneBy({
      id: branchId,
      organizationId,
    });

    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại trong tổ chức này');
    }
  }

  private async findStudentsForExport(
    organizationId: string,
    query: ExportStudentsQueryDto,
  ): Promise<Student[]> {
    const search =
      query.search && query.search.length > 0 ? query.search : undefined;

    const queryBuilder = this.studentsRepository
      .createQueryBuilder('student')
      .select([
        'student.id',
        'student.userId',
        'student.studentCode',
        'student.dateOfBirth',
        'student.address',
        'student.status',
        'student.createdAt',
        'user.id',
        'user.fullName',
        'user.email',
        'user.gender',
      ])
      .leftJoin('student.user', 'user')
      .leftJoinAndSelect('student.branches', 'branch')
      .where('student.organizationId = :organizationId', { organizationId });

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(student.studentCode) LIKE LOWER(:search) ' +
          'OR LOWER(user.fullName) LIKE LOWER(:search) ' +
          'OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('student.status = :status', {
        status: query.status,
      });
    }

    if (query.gender) {
      queryBuilder.andWhere('user.gender = :gender', {
        gender: query.gender,
      });
    }

    if (query.branchId) {
      queryBuilder.andWhere('branch.id = :branchId', {
        branchId: query.branchId,
      });
    }

    queryBuilder.orderBy('student.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  private mapStudentToRow(student: Student): unknown[] {
    const user = student.user ?? ({} as Student['user']);
    const branchNames = (student.branches ?? [])
      .map((branch) => branch.name)
      .filter((name) => typeof name === 'string' && name.length > 0);

    return [
      student.studentCode,
      user.fullName ?? '',
      user.email ?? '',
      student.dateOfBirth ? formatDateOnly(student.dateOfBirth) : '',
      user.gender ? STUDENT_GENDER_LABELS[user.gender] : '',
      branchNames.join(', '),
      STUDENT_STATUS_LABELS[student.status],
      student.address ?? '',
      formatDateTime(student.createdAt),
    ];
  }

  private buildFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `students-${year}-${month}-${day}${EXCEL_EXTENSION}`;
  }
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
