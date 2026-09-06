import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { ExcelRow } from './excel.types';
import { normalizeHeader } from './excel.utils';

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
      .map((value) => normalizeHeader(value));
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
        values: (Array.isArray(values) ? values : Object.values(values)).slice(
          1,
        ),
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

  createTemplate(sheetName: string, headers: string[]): ExcelJS.Workbook {
    const workbook = this.createWorkbook();
    const worksheet = this.addWorksheet(workbook, sheetName);
    this.writeHeaders(worksheet, headers);
    return workbook;
  }
}
