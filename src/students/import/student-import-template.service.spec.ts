import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

import { StudentImportTemplateService } from './student-import-template.service';
import { StudentsService } from '../students.service';
import { ExcelService } from '../../common/excel/excel.service';
import { resolveImportHeaders } from '../../imports/definitions/import-field';
import {
  STUDENT_IMPORT_DEFINITION,
  STUDENT_IMPORT_HEADER_LABELS,
  STUDENT_IMPORT_HEADERS,
} from './student-import.types';

const actorUserId = 'user-manager';
const organizationId = 'org-1';

describe('StudentImportTemplateService', () => {
  let service: StudentImportTemplateService;
  let studentsService: {
    resolveOrganizationId: jest.Mock;
    assertIsAdminOrOwner: jest.Mock;
  };

  beforeEach(async () => {
    studentsService = {
      resolveOrganizationId: jest.fn().mockResolvedValue(organizationId),
      assertIsAdminOrOwner: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentImportTemplateService,
        { provide: StudentsService, useValue: studentsService },
        ExcelService,
      ],
    }).compile();

    service = module.get<StudentImportTemplateService>(
      StudentImportTemplateService,
    );
  });

  describe('authorization', () => {
    it('resolves the organization context and requires an admin', async () => {
      await service.download(actorUserId);

      expect(studentsService.resolveOrganizationId).toHaveBeenCalledWith(
        actorUserId,
      );
      expect(studentsService.assertIsAdminOrOwner).toHaveBeenCalledWith(
        actorUserId,
        organizationId,
      );
    });

    it('allows an owner to download the Vietnamese template file', async () => {
      const result = await service.download(actorUserId);

      const expected = readFileSync(
        join(
          process.cwd(),
          'src',
          'templates',
          'student-import-sample-vi.xlsx',
        ),
      );
      expect(result.buffer.equals(expected)).toBe(true);
      expect(result.filename).toBe('student-import-sample-vi.xlsx');
    });

    it('downloads the English template file when requested', async () => {
      const result = await service.download(actorUserId, 'en');

      const expected = readFileSync(
        join(
          process.cwd(),
          'src',
          'templates',
          'student-import-sample-en.xlsx',
        ),
      );
      expect(result.buffer.equals(expected)).toBe(true);
      expect(result.filename).toBe('student-import-sample-en.xlsx');
    });

    it('rejects a non-manager user', async () => {
      studentsService.assertIsAdminOrOwner.mockRejectedValue(
        new ForbiddenException(
          'Only an owner or admin can perform this action',
        ),
      );

      await expect(service.download(actorUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a user with no membership in the organization', async () => {
      studentsService.resolveOrganizationId.mockRejectedValue(
        new ForbiddenException(
          'User does not have access to this organization',
        ),
      );

      await expect(service.download(actorUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

describe('StudentImportTemplateService (real Excel round-trip)', () => {
  let service: StudentImportTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentImportTemplateService,
        {
          provide: StudentsService,
          useValue: {
            resolveOrganizationId: jest.fn().mockResolvedValue('org-1'),
            assertIsAdminOrOwner: jest.fn().mockResolvedValue(undefined),
          },
        },
        ExcelService,
      ],
    }).compile();

    service = module.get<StudentImportTemplateService>(
      StudentImportTemplateService,
    );
  });

  it('serves the Vietnamese sample workbook with valid headers and both worksheets', async () => {
    const result = await service.download('user-manager');

    const excelService = new ExcelService();
    const workbook = await excelService.readWorkbook(result.buffer);

    expect(result.filename).toBe('student-import-sample-vi.xlsx');

    const students = excelService.getWorksheet(workbook, 'Học sinh');
    const headerLabels = excelService.getHeaders(students);
    expect(
      resolveImportHeaders(headerLabels, STUDENT_IMPORT_DEFINITION),
    ).toEqual([...STUDENT_IMPORT_HEADERS]);

    const expectedLabelValues = STUDENT_IMPORT_HEADERS.map(
      (header) => STUDENT_IMPORT_HEADER_LABELS[header],
    );
    expect(headerLabels).toEqual(expectedLabelValues);

    const rows = excelService.getRows(students);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(rows)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );

    const instructions = excelService.getWorksheet(workbook, 'Hướng dẫn');
    const instructionRows = excelService.getRows(instructions);
    const serialized = JSON.stringify(instructionRows);
    expect(serialized.toLowerCase()).not.toContain('password');
    expect(serialized).toContain('YYYY-MM-DD');

    expect(workbook.worksheets.map((w) => w.name)).toEqual([
      'Học sinh',
      'Hướng dẫn',
    ]);

    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('never contains password, token or real UUID data in the Vietnamese file', async () => {
    const buffer = readFileSync(
      join(process.cwd(), 'src', 'templates', 'student-import-sample-vi.xlsx'),
    );

    const excelService = new ExcelService();
    const workbook = await excelService.readWorkbook(buffer);
    const sampleRows = JSON.stringify(
      excelService.getRows(excelService.getWorksheet(workbook, 'Học sinh')),
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
