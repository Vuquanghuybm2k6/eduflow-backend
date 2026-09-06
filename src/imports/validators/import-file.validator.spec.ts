import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import ExcelJS from 'exceljs';

import { ExcelService } from '../../common/excel/excel.service';
import { EXCEL_MIME_TYPE } from '../../common/excel/excel.constants';
import {
  IMPORT_MAX_FILE_SIZE_BYTES,
  IMPORT_MAX_ROWS,
  ImportFileValidator,
} from './import-file.validator';

const STUDENT_HEADERS = [
  'student_code',
  'full_name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'branch_code',
];

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'students.xlsx',
    encoding: '7bit',
    mimetype: EXCEL_MIME_TYPE,
    buffer: Buffer.alloc(0),
    size: 0,
    ...overrides,
  } as Express.Multer.File;
}

describe('ImportFileValidator', () => {
  let service: ExcelService;
  let validator: ImportFileValidator;

  beforeAll(() => {
    service = new ExcelService();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportFileValidator, ExcelService],
    }).compile();

    validator = module.get(ImportFileValidator);
  });

  async function buildXlsxBuffer(
    headers: string[] = STUDENT_HEADERS,
    rows: unknown[][] = [],
  ): Promise<Buffer> {
    const workbook = service.createWorkbook();
    const worksheet = service.addWorksheet(workbook, 'Students');

    if (headers.length > 0) {
      service.writeHeaders(worksheet, headers);
    }

    service.writeRows(worksheet, rows);
    return service.writeWorkbook(workbook);
  }

  it('rejects when no file is provided', async () => {
    await expect(validator.validate(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a .pdf upload', async () => {
    const buffer = await buildXlsxBuffer();

    await expect(
      validator.validate(makeFile({ originalname: 'students.pdf', buffer })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a .csv upload', async () => {
    const buffer = await buildXlsxBuffer();

    await expect(
      validator.validate(makeFile({ originalname: 'students.csv', buffer })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a .xls upload', async () => {
    const buffer = await buildXlsxBuffer();

    await expect(
      validator.validate(makeFile({ originalname: 'students.xls', buffer })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a file larger than 10MB', async () => {
    const buffer = Buffer.alloc(IMPORT_MAX_FILE_SIZE_BYTES + 1);

    await expect(
      validator.validate(makeFile({ buffer, size: buffer.length })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a file whose MIME type is not xlsx', async () => {
    const buffer = await buildXlsxBuffer();

    await expect(
      validator.validate(
        makeFile({
          originalname: 'students.xlsx',
          mimetype: 'text/plain',
          buffer,
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a corrupted xlsx file even with a valid name and MIME type', async () => {
    const buffer = Buffer.from('this is not a real xlsx payload');

    await expect(
      validator.validate(makeFile({ buffer, size: buffer.length })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a workbook without worksheets', async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(
      validator.validate(makeFile({ buffer, size: buffer.length })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty worksheet', async () => {
    const workbook = service.createWorkbook();
    service.addWorksheet(workbook, 'Empty');
    const buffer = await service.writeWorkbook(workbook);

    await expect(
      validator.validate(makeFile({ buffer, size: buffer.length })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a file with more rows than the limit', async () => {
    const rows: unknown[][] = Array.from(
      { length: IMPORT_MAX_ROWS + 1 },
      (_, i) => [
        `ST${i}`,
        `Student ${i}`,
        `st${i}@gmail.com`,
        '0901234567',
        '2000-01-01',
        'MALE',
        'HN01',
      ],
    );
    const buffer = await buildXlsxBuffer(STUDENT_HEADERS, rows);

    await expect(
      validator.validate(makeFile({ buffer, size: buffer.length })),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns the first worksheet for a valid file', async () => {
    const buffer = await buildXlsxBuffer(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2000-01-01',
        'MALE',
        'HN01',
      ],
    ]);

    const worksheet = await validator.validate(
      makeFile({ buffer, size: buffer.length }),
    );

    expect(worksheet.name).toBe('Students');
  });
});
