import { ForbiddenException, Injectable } from '@nestjs/common';
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
  ImportParsedRow,
  ImportPreview,
  ImportRowResult,
} from './types/import.types';
import { ImportFileValidator } from './validators/import-file.validator';
import { ImportHeaderValidator } from './validators/import-header.validator';
import { ImportRowValidator } from './validators/import-row.validator';
import { ImportBusinessValidator } from './validators/import-business.validator';

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly fileValidator: ImportFileValidator,
    private readonly headerValidator: ImportHeaderValidator,
    private readonly rowValidator: ImportRowValidator,
    private readonly businessValidator: ImportBusinessValidator,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
  ) {}

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
    this.headerValidator.validate(headers);

    const excelRows = this.excelService.getRows(worksheet);
    const parsedRows = this.parseRows(excelRows, headers);
    const results = this.rowValidator.validateRows(parsedRows);
    await this.businessValidator.addBusinessErrors(results, organizationId);

    return this.buildPreview(results);
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

  private buildPreview(results: ImportRowResult[]): ImportPreview {
    const totalRows = results.length;
    const validRows = results.filter((row) => row.valid).length;

    return {
      totalRows,
      validRows,
      invalidRows: totalRows - validRows,
      rows: results,
    };
  }
}
