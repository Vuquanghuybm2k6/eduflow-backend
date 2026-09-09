import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExcelService } from '../../common/excel/excel.service';
import { EXCEL_EXTENSION } from '../../common/excel/excel.constants';
import { Branch } from '../../branches/entities/branch.entity';
import { Teacher } from '../entities/teacher.entity';
import { TeachersService } from '../teachers.service';
import { ExportTeachersQueryDto } from '../dto/export-teachers-query.dto';
import {
  TEACHER_EXPORT_BIO_COLUMN_INDEX,
  TEACHER_EXPORT_BRANCHES_COLUMN_INDEX,
  TEACHER_EXPORT_COLUMN_WIDTHS,
  TEACHER_EXPORT_HEADERS,
  TEACHER_EXPORT_QUALIFICATION_COLUMN_INDEX,
  TEACHER_EXPORT_SHEET_NAME,
  TEACHER_GENDER_LABELS,
  TEACHER_STATUS_LABELS,
  TeacherExportResult,
} from './teacher-export.types';

@Injectable()
export class TeacherExportService {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly excelService: ExcelService,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async export(
    actorUserId: string,
    query: ExportTeachersQueryDto,
  ): Promise<TeacherExportResult> {
    const organizationId = await this.teachersService.resolveOrganizationId(
      actorUserId,
      query.organizationId,
    );
    await this.teachersService.assertIsAdminOrOwner(
      actorUserId,
      organizationId,
    );

    await this.assertBranchBelongsToOrganization(
      organizationId,
      query.branchId,
    );

    const teachers = await this.findTeachersForExport(organizationId, query);

    const rows = teachers.map((teacher) => this.mapTeacherToRow(teacher));

    const workbook = this.excelService.exportWorksheet({
      name: TEACHER_EXPORT_SHEET_NAME,
      headers: [...TEACHER_EXPORT_HEADERS],
      rows,
      columnWidths: [...TEACHER_EXPORT_COLUMN_WIDTHS],
      wrapColumns: [
        TEACHER_EXPORT_QUALIFICATION_COLUMN_INDEX,
        TEACHER_EXPORT_BIO_COLUMN_INDEX,
        TEACHER_EXPORT_BRANCHES_COLUMN_INDEX,
      ],
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

  private async findTeachersForExport(
    organizationId: string,
    query: ExportTeachersQueryDto,
  ): Promise<Teacher[]> {
    const search =
      query.search && query.search.length > 0 ? query.search : undefined;

    const queryBuilder = this.teachersRepository
      .createQueryBuilder('teacher')
      .select([
        'teacher.id',
        'teacher.userId',
        'teacher.teacherCode',
        'teacher.specialization',
        'teacher.qualification',
        'teacher.bio',
        'teacher.hireDate',
        'teacher.status',
        'teacher.createdAt',
        'user.id',
        'user.fullName',
        'user.email',
        'user.gender',
      ])
      .leftJoin('teacher.user', 'user')
      .leftJoinAndSelect('teacher.branches', 'branch')
      .where('teacher.organizationId = :organizationId', { organizationId });

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(teacher.teacherCode) LIKE LOWER(:search) ' +
          'OR LOWER(user.fullName) LIKE LOWER(:search) ' +
          'OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (query.status) {
      queryBuilder.andWhere('teacher.status = :status', {
        status: query.status,
      });
    }

    if (query.specialization) {
      queryBuilder.andWhere('teacher.specialization = :specialization', {
        specialization: query.specialization,
      });
    }

    if (query.branchId) {
      queryBuilder.andWhere('branch.id = :branchId', {
        branchId: query.branchId,
      });
    }

    queryBuilder.orderBy('teacher.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  private mapTeacherToRow(teacher: Teacher): unknown[] {
    const user = teacher.user ?? ({} as Teacher['user']);
    const branchNames = (teacher.branches ?? [])
      .map((branch) => branch.name)
      .filter((name) => typeof name === 'string' && name.length > 0);

    return [
      teacher.teacherCode,
      user.fullName ?? '',
      user.email ?? '',
      teacher.specialization ?? '',
      teacher.qualification ?? '',
      teacher.bio ?? '',
      teacher.hireDate ? formatDateOnly(teacher.hireDate) : '',
      user.gender ? TEACHER_GENDER_LABELS[user.gender] : '',
      branchNames.join(', '),
      TEACHER_STATUS_LABELS[teacher.status],
      formatDateTime(teacher.createdAt),
    ];
  }

  private buildFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `teachers-${year}-${month}-${day}${EXCEL_EXTENSION}`;
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
