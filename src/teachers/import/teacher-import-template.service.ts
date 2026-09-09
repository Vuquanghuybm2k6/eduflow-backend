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
import { TeachersService } from '../teachers.service';
import {
  TEACHER_IMPORT_FIELDS,
  TEACHER_IMPORT_WORKSHEET_NAME,
} from './teacher-import.constants';

export const TEACHER_IMPORT_TEMPLATE_WORKSHEET_NAME = 'Instructions';
export const TEACHER_IMPORT_TEMPLATE_FILENAME = `teacher-import-template${EXCEL_EXTENSION}`;
export const TEACHER_IMPORT_SAMPLE_FILENAME_VI = `teacher-import-sample-vi${EXCEL_EXTENSION}`;
export const TEACHER_IMPORT_SAMPLE_FILENAME_EN = `teacher-import-sample-en${EXCEL_EXTENSION}`;

export interface TeacherImportTemplateColumnInput {
  key: string;
  required: boolean;
  description: string;
  example: string;
}

export interface TeacherImportTemplateColumn extends TeacherImportTemplateColumnInput {
  label: string;
}

export const TEACHER_IMPORT_TEMPLATE_COLUMNS: readonly ImportFieldDefinition[] =
  TEACHER_IMPORT_FIELDS;

export interface TeacherImportTemplateResult {
  buffer: Buffer;
  filename: string;
}

const INSTRUCTIONS_COLUMN_WIDTHS = [18, 12, 60, 32];

@Injectable()
export class TeacherImportTemplateService {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly excelService: ExcelService,
  ) {}

  async download(
    actorUserId: string,
    language: ImportTemplateLanguage = DEFAULT_IMPORT_TEMPLATE_LANGUAGE,
  ): Promise<TeacherImportTemplateResult> {
    const organizationId =
      await this.teachersService.resolveOrganizationId(actorUserId);
    await this.teachersService.assertIsAdminOrOwner(
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
      ? TEACHER_IMPORT_SAMPLE_FILENAME_EN
      : TEACHER_IMPORT_SAMPLE_FILENAME_VI;
  }

  private buildWorkbook(): ExcelJS.Workbook {
    const workbook = this.excelService.exportWorksheet({
      name: TEACHER_IMPORT_WORKSHEET_NAME,
      headers: TEACHER_IMPORT_TEMPLATE_COLUMNS.map((column) => column.label),
      rows: [this.buildSampleRow()],
      columnWidths: [30, 25, 16, 25, 25, 40, 16, 14, 30],
      wrapColumns: [6, 9],
    });

    const instructions = this.excelService.addWorksheet(
      workbook,
      TEACHER_IMPORT_TEMPLATE_WORKSHEET_NAME,
    );

    this.populateInstructions(instructions);

    return workbook;
  }

  private buildSampleRow(): unknown[] {
    return [
      'nguyenvana.template@gmail.com',
      'Nguyen Van A',
      'GV001',
      'Mathematics',
      'Bachelor of Mathematics',
      'Experienced mathematics teacher',
      '2026-09-01',
      'FEMALE',
      'BR001,BR002',
    ];
  }

  private populateInstructions(worksheet: ExcelJS.Worksheet): void {
    for (let index = 0; index < INSTRUCTIONS_COLUMN_WIDTHS.length; index++) {
      worksheet.getColumn(index + 1).width = INSTRUCTIONS_COLUMN_WIDTHS[index];
    }

    worksheet.addRow(['Teacher Import Template']);
    worksheet.getRow(1).font = { bold: true, size: 16 };

    worksheet.addRow([
      'Dùng mẫu này để nhập giáo viên vào EduFlow. Điền dữ liệu thật vào từng dòng, mỗi dòng đại diện cho một giáo viên. Bỏ qua các dòng mẫu trước khi upload.',
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

    for (const column of TEACHER_IMPORT_TEMPLATE_COLUMNS) {
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
      '3. Mỗi dòng đại diện cho một giáo viên.',
      '4. Email phải hợp lệ và kết thúc bằng @gmail.com.',
      '5. Mã giáo viên phải duy nhất trong tổ chức.',
      '6. Mã chi nhánh phải tồn tại trong tổ chức hiện tại.',
      '7. Nhập nhiều chi nhánh, ngăn cách bằng dấu phẩy (VD: BR001,BR002).',
      '8. Không nhập UUID vào file.',
      '9. Không nhập mật khẩu vào file Excel này.',
      '10. Xóa các dòng mẫu trước khi nhập dữ liệu thật.',
    ];

    for (const rule of rules) {
      worksheet.addRow([rule]);
    }
  }
}
