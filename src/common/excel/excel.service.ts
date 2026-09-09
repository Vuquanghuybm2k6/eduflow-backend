import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { ExcelExportWorksheet, ExcelRow } from './excel.types';
import {
  normalizeCellValue,
  readHeaderText,
  sanitizeExcelString,
} from './excel.utils';

type ExcelJsBuffer = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

@Injectable()
export class ExcelService {
  async readWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const data: ExcelJsBuffer = buffer as unknown as ExcelJsBuffer;
    await workbook.xlsx.load(data);
    return workbook;
  }

  getWorksheet(
    workbook: ExcelJS.Workbook,
    sheetName?: string,
  ): ExcelJS.Worksheet {
    if (sheetName) {
      const worksheet = workbook.getWorksheet(sheetName);

      if (!worksheet) {
        throw new Error(`Worksheet "${sheetName}" not found`);
      }

      return worksheet;
    }

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Workbook does not contain any worksheet');
    }

    return worksheet;
  }

  getHeaders(worksheet: ExcelJS.Worksheet): string[] {
    const headerRow = worksheet.getRow(1);
    const values = headerRow.values;

    return (Array.isArray(values) ? values : Object.values(values))
      .slice(1)
      .map((value) => readHeaderText(value));
  }

  getRows(worksheet: ExcelJS.Worksheet): ExcelRow[] {
    const rows: ExcelRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const values = row.values;

      rows.push({
        rowNumber,
        values: (Array.isArray(values) ? values : Object.values(values))
          .slice(1)
          .map((value) => normalizeCellValue(value)),
      });
    });

    return rows;
  }

  createWorkbook(): ExcelJS.Workbook {
    return new ExcelJS.Workbook();
  }

  addWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
    return workbook.addWorksheet(name);
  }

  writeHeaders(worksheet: ExcelJS.Worksheet, headers: string[]): void {
    worksheet.addRow(headers);
  }

  writeRows(worksheet: ExcelJS.Worksheet, rows: unknown[][]): void {
    for (const row of rows) {
      worksheet.addRow(row);
    }
  }

  async writeWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  exportWorksheet(options: ExcelExportWorksheet): ExcelJS.Workbook {
    const workbook = this.createWorkbook();
    const worksheet = this.addWorksheet(workbook, options.name);

    if (options.columnWidths) {
      options.columnWidths.forEach((width, index) => {
        if (width > 0) {
          worksheet.getColumn(index + 1).width = width;
        }
      });
    }

    for (const column of options.wrapColumns ?? []) {
      worksheet.getColumn(column).alignment = {
        vertical: 'top' as const,
        wrapText: true,
      };
    }

    const headerRow = worksheet.addRow(options.headers);
    headerRow.font = { bold: true };
    headerRow.alignment = {
      vertical: 'middle' as const,
      horizontal: 'center' as const,
    };
    headerRow.height = 28;

    for (const row of options.rows) {
      worksheet.addRow(row.map((value) => sanitizeExcelString(value)));
    }

    worksheet.views = [{ state: 'frozen' as const, ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(1, options.headers.length) },
    };

    return workbook;
  }

  createTemplate(sheetName: string, headers: string[]): ExcelJS.Workbook {
    const workbook = this.createWorkbook();
    const worksheet = this.addWorksheet(workbook, sheetName);
    this.writeHeaders(worksheet, headers);
    return workbook;
  }
}
