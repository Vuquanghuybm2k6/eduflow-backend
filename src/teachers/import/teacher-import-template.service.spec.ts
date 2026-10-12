import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';

import { TeacherImportTemplateService } from './teacher-import-template.service';
import { ExcelService } from '../../common/excel/excel.service';
import { resolveImportHeaders } from '../../imports/definitions/import-field';
import {
  TEACHER_IMPORT_DEFINITION,
  TEACHER_IMPORT_HEADERS,
} from './teacher-import.constants';

const actorUserId = 'user-manager';
const organizationId = 'org-1';

describe('TeacherImportTemplateService', () => {
  let service: TeacherImportTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeacherImportTemplateService, ExcelService],
    }).compile();

    service = module.get<TeacherImportTemplateService>(
      TeacherImportTemplateService,
    );
  });

  describe('templates', () => {
    it('downloads the Vietnamese template file', () => {
      const result = service.download(actorUserId, organizationId);

      const expected = readFileSync(
        join(
          process.cwd(),
          'src',
          'templates',
          'teacher-import-sample-vi.xlsx',
        ),
      );
      expect(result.buffer.equals(expected)).toBe(true);
      expect(result.filename).toBe('teacher-import-sample-vi.xlsx');
    });

    it('downloads the English template file when requested', () => {
      const result = service.download(actorUserId, organizationId, 'en');

      const expected = readFileSync(
        join(
          process.cwd(),
          'src',
          'templates',
          'teacher-import-sample-en.xlsx',
        ),
      );
      expect(result.buffer.equals(expected)).toBe(true);
      expect(result.filename).toBe('teacher-import-sample-en.xlsx');
    });
  });
});

describe('TeacherImportTemplateService (real Excel round-trip)', () => {
  let service: TeacherImportTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeacherImportTemplateService, ExcelService],
    }).compile();

    service = module.get<TeacherImportTemplateService>(
      TeacherImportTemplateService,
    );
  });

  it('serves the Vietnamese sample workbook with valid headers and both worksheets', async () => {
    const result = service.download('user-manager', 'org-1');

    const excelService = new ExcelService();
    const workbook = await excelService.readWorkbook(result.buffer);

    expect(result.filename).toBe('teacher-import-sample-vi.xlsx');

    const teachers = excelService.getWorksheet(workbook, 'Teachers');
    const headerLabels = excelService.getHeaders(teachers);
    expect(
      resolveImportHeaders(headerLabels, TEACHER_IMPORT_DEFINITION),
    ).toEqual([...TEACHER_IMPORT_HEADERS]);

    const rows = excelService.getRows(teachers);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(rows)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );

    const instructions = excelService.getWorksheet(workbook, 'Instructions');
    const instructionRows = excelService.getRows(instructions);
    const serialized = JSON.stringify(instructionRows);
    expect(serialized.toLowerCase()).not.toContain('password');
    expect(serialized).toContain('YYYY-MM-DD');

    expect(workbook.worksheets.map((w) => w.name)).toEqual([
      'Teachers',
      'Instructions',
    ]);

    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('never contains password, token or real UUID data in the Vietnamese file', async () => {
    const buffer = readFileSync(
      join(process.cwd(), 'src', 'templates', 'teacher-import-sample-vi.xlsx'),
    );

    const excelService = new ExcelService();
    const workbook = await excelService.readWorkbook(buffer);
    const sampleRows = JSON.stringify(
      excelService.getRows(excelService.getWorksheet(workbook, 'Teachers')),
    );

    expect(sampleRows.toLowerCase()).not.toContain('password');
    expect(sampleRows.toLowerCase()).not.toContain('token');
    expect(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
        sampleRows,
      ),
    ).toBe(false);
  });
});
