import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { ExcelService } from '../../common/excel/excel.service';
import { EXCEL_EXTENSION } from '../../common/excel/excel.constants';
import {
  DEFAULT_IMPORT_TEMPLATE_LANGUAGE,
  type ImportTemplateLanguage,
} from '../../imports/import-template.constants';
import type { ImportFieldDefinition } from '../../imports/definitions/import-field';
import { StudentsService } from '../students.service';
import { STUDENT_IMPORT_FIELDS } from './student-import.types';

export const STUDENT_IMPORT_TEMPLATE_WORKSHEET_NAME = 'Students';
export const STUDENT_IMPORT_TEMPLATE_INSTRUCTIONS_NAME = 'Instructions';
export const STUDENT_IMPORT_TEMPLATE_FILENAME = `student-import-template${EXCEL_EXTENSION}`;
export const STUDENT_IMPORT_SAMPLE_FILENAME_VI = `student-import-sample-vi${EXCEL_EXTENSION}`;
export const STUDENT_IMPORT_SAMPLE_FILENAME_EN = `student-import-sample-en${EXCEL_EXTENSION}`;

export interface StudentImportTemplateColumnInput {
  key: string;
  required: boolean;
  description: string;
  example: string;
}

export interface StudentImportTemplateColumn extends StudentImportTemplateColumnInput {
  label: string;
}

export const STUDENT_IMPORT_TEMPLATE_COLUMNS: readonly ImportFieldDefinition[] =
  STUDENT_IMPORT_FIELDS;

export interface StudentImportTemplateResult {
  buffer: Buffer;
  filename: string;
}

const INSTRUCTIONS_COLUMN_WIDTHS = [18, 12, 60, 32];

@Injectable()
export class StudentImportTemplateService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly excelService: ExcelService,
  ) {}

  async download(
    actorUserId: string,
    language: ImportTemplateLanguage = DEFAULT_IMPORT_TEMPLATE_LANGUAGE,
  ): Promise<StudentImportTemplateResult> {
    const organizationId =
      await this.studentsService.resolveOrganizationId(actorUserId);
    await this.studentsService.assertIsAdminOrOwner(
      actorUserId,
      organizationId,
    );

    const buffer = readFileSync(
      join(
        process.cwd(),
        'src',
        'templates',
        this.resolveSampleFileName(language),
      ),
    );

    return {
      buffer,
      filename: this.resolveSampleFileName(language),
    };
  }

  private resolveSampleFileName(language: ImportTemplateLanguage): string {
    return language === 'en'
      ? STUDENT_IMPORT_SAMPLE_FILENAME_EN
      : STUDENT_IMPORT_SAMPLE_FILENAME_VI;
  }

  private buildWorkbook(): ExcelJS.Workbook {
    const workbook = this.excelService.exportWorksheet({
      name: STUDENT_IMPORT_TEMPLATE_WORKSHEET_NAME,
      headers: STUDENT_IMPORT_TEMPLATE_COLUMNS.map((column) => column.label),
      rows: [this.buildSampleRow()],
      columnWidths: [16, 25, 30, 20, 16, 14, 16],
      wrapColumns: [2],
    });

    const instructions = this.excelService.addWorksheet(
      workbook,
      STUDENT_IMPORT_TEMPLATE_INSTRUCTIONS_NAME,
    );

    this.populateInstructions(instructions);

    return workbook;
  }

  private buildSampleRow(): unknown[] {
    return [
      'HS001',
      'Nguyen Van A',
      'nguyenvana.template@gmail.com',
      '0901234567',
      '2015-09-01',
      'MALE',
      'BR001',
    ];
  }

  private populateInstructions(worksheet: ExcelJS.Worksheet): void {
    for (let index = 0; index < INSTRUCTIONS_COLUMN_WIDTHS.length; index++) {
      worksheet.getColumn(index + 1).width = INSTRUCTIONS_COLUMN_WIDTHS[index];
    }

    worksheet.addRow(['Student Import Template']);
    worksheet.getRow(1).font = { bold: true, size: 16 };

    worksheet.addRow([
      'Dùng mẫu này để nhập học viên vào EduFlow. Điền dữ liệu thật vào từng dòng, mỗi dòng đại diện cho một học viên. Bỏ qua các dòng mẫu trước khi upload.',
    ]);
    worksheet.getRow(2).alignment = { wrapText: true };

    worksheet.addRow([]);

    const tableHead = worksheet.addRow([
      'Tên cột',
      'Bắt buộc',
      'Mô tả',
      'Ví dụ',
    ]);
    tableHead.font = { bold: true };
    tableHead.height = 24;

    for (const column of STUDENT_IMPORT_TEMPLATE_COLUMNS) {
      worksheet.addRow([
        column.label,
        column.required ? 'Có' : 'Không',
        column.description,
        column.example,
      ]);
    }

    worksheet.addRow([]);
    const rulesTitle = worksheet.addRow(['Import Rules']);
    rulesTitle.font = { bold: true, size: 14 };

    const rules = [
      '1. Không đổi tên các cột.',
      '2. Không xóa các cột bắt buộc.',
      '3. Mỗi dòng đại diện cho một học viên.',
      '4. Email phải hợp lệ và kết thúc bằng @gmail.com.',
      '5. Mã học viên phải duy nhất trong tổ chức.',
      '6. Mã chi nhánh phải tồn tại trong tổ chức hiện tại.',
      '7. Không nhập UUID vào file.',
      '8. Không nhập mật khẩu vào file Excel này.',
      '9. Xóa các dòng mẫu trước khi nhập dữ liệu thật.',
    ];

    for (const rule of rules) {
      worksheet.addRow([rule]);
    }
  }
}
