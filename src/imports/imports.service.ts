import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExcelService } from '../common/excel/excel.service';
import { ExcelRow } from '../common/excel/excel.types';
import { isEmptyRow, normalizeHeader } from '../common/excel/excel.utils';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import {
  STUDENT_IMPORT_HEADERS,
  StudentImportMeta,
} from '../students/import/student-import.types';
import { StudentImportExecutor } from '../students/import/student-import.executor';
import {
  StudentImportBusinessValidator,
  StudentImportRowValidator,
} from '../students/import/student-import.validator';
import { ImportJob, ImportJobStatus } from './entities/import-job.entity';
import {
  ImportJobRow,
  ImportJobRowStatus,
} from './entities/import-job-row.entity';
import {
  ImportJobResult,
  ImportJobRowOutcome,
  ImportJobRowResult,
  ImportParsedRow,
  ImportPreview,
  ImportRowResult,
} from './types/import.types';
import { EXCEL_EXTENSION } from '../common/excel/excel.constants';
import { IMPORT_MAX_FILE_SIZE_BYTES } from './validators/import-file.validator';
import { ImportFileValidator } from './validators/import-file.validator';
import { ImportHeaderValidator } from './validators/import-header.validator';

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly fileValidator: ImportFileValidator,
    private readonly headerValidator: ImportHeaderValidator,
    private readonly rowValidator: StudentImportRowValidator,
    private readonly businessValidator: StudentImportBusinessValidator,
    private readonly studentImportExecutor: StudentImportExecutor,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(ImportJob)
    private readonly importJobsRepository: Repository<ImportJob>,
    @InjectRepository(ImportJobRow)
    private readonly importJobRowsRepository: Repository<ImportJobRow>,
  ) {}

  getStudentImportMeta(): StudentImportMeta {
    return {
      headers: [...STUDENT_IMPORT_HEADERS],
      headerLabels: {
        student_code: 'Mã học viên',
        full_name: 'Họ và tên',
        email: 'Email',
        phone: 'Số điện thoại',
        date_of_birth: 'Ngày sinh',
        gender: 'Giới tính',
        branch_code: 'Mã chi nhánh',
      },
      maxFileSizeBytes: IMPORT_MAX_FILE_SIZE_BYTES,
      allowedExtensions: [EXCEL_EXTENSION],
    };
  }

  async previewStudentImport(
    file: Express.Multer.File | undefined,
    userId: string,
    options: OrgContextOptions = {},
  ): Promise<ImportPreview> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const worksheet = await this.fileValidator.validate(file);
    const headers = this.excelService.getHeaders(worksheet);
    this.headerValidator.validate(headers, STUDENT_IMPORT_HEADERS);

    const excelRows = this.excelService.getRows(worksheet);
    const parsedRows = this.parseRows(excelRows, headers);
    const results = this.rowValidator.validateRows(parsedRows);
    await this.businessValidator.addBusinessErrors(results, organizationId);

    const fileName = file?.originalname ?? 'student-import.xlsx';

    const importJob = await this.persistPreview(
      organizationId,
      userId,
      fileName,
      results,
    );

    return this.buildPreview(importJob.id, results);
  }

  async confirmStudentImport(
    importJobId: string,
    userId: string,
    options: OrgContextOptions = {},
  ): Promise<ImportJobResult> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(userId, organizationId);

    const importJob = await this.importJobsRepository.findOne({
      where: { id: importJobId, organizationId },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    await this.claimImportJob(importJob);

    const rows = await this.importJobRowsRepository.find({
      where: { importJobId: importJob.id },
      order: { rowNumber: 'ASC' },
    });

    const validRows = rows.filter(
      (r) => r.status === ImportJobRowStatus.PENDING,
    );

    let successCount = 0;
    let failCount = 0;
    const rowResults: ImportJobRowResult[] = [];

    for (const row of rows) {
      if (row.status === ImportJobRowStatus.FAILED) {
        failCount++;
        rowResults.push({
          rowNumber: row.rowNumber,
          status: ImportJobRowOutcome.FAILED,
          errors: row.errors,
        });
      }
    }

    for (const row of validRows) {
      try {
        await this.studentImportExecutor.execute(row, organizationId);
        successCount++;
        await this.importJobRowsRepository.update(row.id, {
          status: ImportJobRowStatus.SUCCESS,
          errors: [],
        });
        rowResults.push({
          rowNumber: row.rowNumber,
          status: ImportJobRowOutcome.SUCCESS,
          errors: [],
        });
      } catch (error) {
        failCount++;
        const errors = this.extractRowErrors(error);
        await this.importJobRowsRepository.update(row.id, {
          status: ImportJobRowStatus.FAILED,
          errors,
        });
        rowResults.push({
          rowNumber: row.rowNumber,
          status: ImportJobRowOutcome.FAILED,
          errors,
        });
      }
    }

    rowResults.sort((a, b) => a.rowNumber - b.rowNumber);

    await this.importJobsRepository.update(importJob.id, {
      status: ImportJobStatus.COMPLETED,
      successRows: successCount,
      failedRows: failCount,
      completedAt: new Date(),
    });

    return {
      importJobId: importJob.id,
      total: importJob.totalRows,
      success: successCount,
      failed: failCount,
      rows: rowResults,
    };
  }

  private async claimImportJob(importJob: ImportJob): Promise<void> {
    if (importJob.status !== ImportJobStatus.PREVIEW) {
      throw new BadRequestException(
        `Import job is not in PREVIEW status (current: ${importJob.status})`,
      );
    }

    const result = await this.importJobsRepository.update(
      { id: importJob.id, status: ImportJobStatus.PREVIEW },
      { status: ImportJobStatus.PROCESSING, startedAt: new Date() },
    );

    if (result.affected === 0) {
      throw new BadRequestException(
        'Import job has already been claimed by another request',
      );
    }
  }

  private extractRowErrors(
    error: unknown,
  ): Array<{ field: string; message: string }> {
    if (error instanceof ConflictException) {
      const message = error.message;
      let field = 'general';

      if (message.toLowerCase().includes('email')) {
        field = 'email';
      } else if (message.toLowerCase().includes('student code')) {
        field = 'student_code';
      } else if (message.toLowerCase().includes('branch')) {
        field = 'branch_code';
      }

      return [{ field, message }];
    }

    return [{ field: 'general', message: 'An unexpected error occurred' }];
  }

  private async persistPreview(
    organizationId: string,
    userId: string,
    fileName: string,
    results: ImportRowResult[],
  ): Promise<ImportJob> {
    const importJob = await this.importJobsRepository.save(
      this.importJobsRepository.create({
        organizationId,
        entityType: 'student',
        fileName,
        status: ImportJobStatus.PREVIEW,
        totalRows: results.length,
        createdBy: userId,
      }),
    );

    const rowEntities = results.map((result) =>
      this.importJobRowsRepository.create({
        importJobId: importJob.id,
        rowNumber: result.rowNumber,
        rawData: result.values,
        normalizedData: result.values,
        status: result.valid
          ? ImportJobRowStatus.PENDING
          : ImportJobRowStatus.FAILED,
        errors: result.errors.map((e) => ({
          field: e.field,
          message: e.message,
        })),
      }),
    );

    await this.importJobRowsRepository.save(rowEntities);

    return importJob;
  }

  private async assertIsAdminOrOwner(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.membershipsRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { role: true },
    });

    if (!membership || !membership.role) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    const roleName = membership.role.name.toLowerCase();
    const isManager = roleName.includes('owner') || roleName.includes('admin');

    if (!isManager) {
      throw new ForbiddenException(
        'Only an owner or admin can perform this action',
      );
    }
  }

  private async resolveOrganizationId(
    userId: string,
    requestedOrganizationId?: string,
  ): Promise<string> {
    const queryBuilder = this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.organization', 'organization')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.ACTIVE,
      });

    if (requestedOrganizationId) {
      queryBuilder.andWhere('membership.organizationId = :organizationId', {
        organizationId: requestedOrganizationId,
      });
    }

    queryBuilder
      .orderBy('membership.joinedAt', 'ASC')
      .addOrderBy('membership.createdAt', 'ASC')
      .limit(1);

    const membership = await queryBuilder.getOne();

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    return membership.organizationId;
  }

  private parseRows(
    excelRows: ExcelRow[],
    headers: string[],
  ): ImportParsedRow[] {
    return excelRows
      .filter((row) => !isEmptyRow(row.values))
      .map((row) => {
        const data: Record<string, unknown> = {};

        headers.forEach((header, index) => {
          if (header) {
            data[normalizeHeader(header).toLowerCase()] = row.values[index];
          }
        });

        return { rowNumber: row.rowNumber, data };
      });
  }

  private buildPreview(
    importJobId: string,
    results: ImportRowResult[],
  ): ImportPreview {
    const totalRows = results.length;
    const validRows = results.filter((row) => row.valid).length;

    return {
      importJobId,
      totalRows,
      validRows,
      invalidRows: totalRows - validRows,
      rows: results,
    };
  }
}