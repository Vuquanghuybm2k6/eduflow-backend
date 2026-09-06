import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { extname } from 'node:path';

import { ExcelService } from '../../common/excel/excel.service';
import {
  EXCEL_EXTENSION,
  EXCEL_MIME_TYPE,
} from '../../common/excel/excel.constants';

export const IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10000;

@Injectable()
export class ImportFileValidator {
  constructor(private readonly excelService: ExcelService) {}

  async validate(
    file: Express.Multer.File | undefined,
  ): Promise<ExcelJS.Worksheet> {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File vượt quá giới hạn ${IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
      );
    }

    const extension = extname(file.originalname ?? '').toLowerCase();

    if (extension !== EXCEL_EXTENSION) {
      throw new BadRequestException('Chỉ hỗ trợ định dạng file .xlsx');
    }

    if (file.mimetype && file.mimetype !== EXCEL_MIME_TYPE) {
      throw new BadRequestException('File không phải là file Excel hợp lệ');
    }

    let workbook: ExcelJS.Workbook;

    try {
      workbook = await this.excelService.readWorkbook(file.buffer);
    } catch {
      throw new BadRequestException(
        'File không phải là file Excel hợp lệ hoặc file đã bị lỗi',
      );
    }

    let worksheet: ExcelJS.Worksheet;

    try {
      worksheet = this.excelService.getWorksheet(workbook);
    } catch {
      throw new BadRequestException('File Excel không chứa worksheet nào');
    }

    const headers = this.excelService.getHeaders(worksheet);
    const rows = this.excelService.getRows(worksheet);

    const hasContent =
      headers.some((header) => header !== '') || rows.length > 0;

    if (!hasContent) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    if (rows.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `File vượt quá giới hạn ${IMPORT_MAX_ROWS} dòng dữ liệu`,
      );
    }

    return worksheet;
  }
}
