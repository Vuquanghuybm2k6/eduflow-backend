import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ExcelService } from '../common/excel/excel.service';
import { EXCEL_MIME_TYPE } from '../common/excel/excel.constants';
import { Membership } from '../memberships/entities/membership.entity';
import { StudentImportExecutor } from '../students/import/student-import.executor';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobRow } from './entities/import-job-row.entity';
import { ImportBusinessValidator } from './validators/import-business.validator';
import { ImportFileValidator } from './validators/import-file.validator';
import { ImportHeaderValidator } from './validators/import-header.validator';
import { ImportRowValidator } from './validators/import-row.validator';
import { ImportsService } from './imports.service';

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

describe('ImportsService', () => {
  let service: ImportsService;
  let excelService: ExcelService;
  let businessValidator: { addBusinessErrors: jest.Mock };
  let queryBuilderMock: {
    innerJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    limit: jest.Mock;
    getOne: jest.Mock;
  };
  let membershipsRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };
  let importJobsRepository: {
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
  };
  let importJobRowsRepository: {
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let studentImportExecutor: { execute: jest.Mock };

  beforeAll(() => {
    excelService = new ExcelService();
  });

  beforeEach(async () => {
    businessValidator = {
      addBusinessErrors: jest.fn().mockResolvedValue(undefined),
    };
    queryBuilderMock = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    };
    membershipsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      findOne: jest.fn().mockResolvedValue({
        id: 'm1',
        userId: 'user-1',
        organizationId: 'org-1',
        status: 'ACTIVE',
        role: { name: 'Owner', id: 'role-owner' },
      }),
    };
    importJobsRepository = {
      save: jest
        .fn()
        .mockImplementation((jobArg) =>
          Promise.resolve({ ...jobArg, id: 'job-1' }),
        ),
      create: jest.fn().mockImplementation((arg) => arg),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    importJobRowsRepository = {
      save: jest.fn().mockImplementation((rows) => Promise.resolve(rows)),
      create: jest.fn().mockImplementation((arg) => arg),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    studentImportExecutor = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        ExcelService,
        ImportFileValidator,
        ImportHeaderValidator,
        ImportRowValidator,
        { provide: ImportBusinessValidator, useValue: businessValidator },
        { provide: StudentImportExecutor, useValue: studentImportExecutor },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipsRepository,
        },
        {
          provide: getRepositoryToken(ImportJob),
          useValue: importJobsRepository,
        },
        {
          provide: getRepositoryToken(ImportJobRow),
          useValue: importJobRowsRepository,
        },
      ],
    }).compile();

    service = module.get(ImportsService);
  });

  async function buildXlsx(
    headers: string[] = STUDENT_HEADERS,
    rows: unknown[][] = [],
  ): Promise<Buffer> {
    const workbook = excelService.createWorkbook();
    const worksheet = excelService.addWorksheet(workbook, 'Students');
    excelService.writeHeaders(worksheet, headers);
    excelService.writeRows(worksheet, rows);
    return excelService.writeWorkbook(workbook);
  }

  it('returns a preview with valid rows for a correct file', async () => {
    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
      [
        'ST002',
        'Nguyen B',
        'b@gmail.com',
        '0901234568',
        '2005-02-03',
        'FEMALE',
        'HN01',
      ],
    ]);

    const preview = await service.previewStudentImport(
      makeFile({ buffer, size: buffer.length }),
      'user-1',
    );

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(2);
    expect(preview.invalidRows).toBe(0);
    expect(preview.rows.map((item) => item.rowNumber)).toEqual([2, 3]);
  });

  it('skips trailing empty rows while keeping real excel row numbers', async () => {
    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
      ['', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
    ]);

    const preview = await service.previewStudentImport(
      makeFile({ buffer, size: buffer.length }),
      'user-1',
    );

    expect(preview.totalRows).toBe(1);
    expect(preview.rows[0].rowNumber).toBe(2);
  });

  it('marks duplicate rows inside the file as invalid', async () => {
    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
      [
        'ST001',
        'Nguyen C',
        'c@gmail.com',
        '0901234569',
        '2004-05-06',
        'MALE',
        'HN01',
      ],
    ]);

    const preview = await service.previewStudentImport(
      makeFile({ buffer, size: buffer.length }),
      'user-1',
    );

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(1);
    expect(preview.rows[1].valid).toBe(false);
  });

  it('rejects a file missing a required column', async () => {
    const headers = [
      'student_code',
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
    ];
    const buffer = await buildXlsx(headers, [
      ['ST001', 'Nguyen A', 'a@gmail.com', '0901234567', '2006-01-01', 'MALE'],
    ]);

    await expect(
      service.previewStudentImport(
        makeFile({ buffer, size: buffer.length }),
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when no file is provided', async () => {
    await expect(
      service.previewStudentImport(undefined, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a corrupted file', async () => {
    const buffer = Buffer.from('garbage');

    await expect(
      service.previewStudentImport(
        makeFile({ buffer, size: buffer.length }),
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when the user has no active membership in the organization', async () => {
    queryBuilderMock.getOne.mockResolvedValue(null);

    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
    ]);

    await expect(
      service.previewStudentImport(
        makeFile({ buffer, size: buffer.length }),
        'user-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('passes the resolved organizationId to the business validator', async () => {
    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
    ]);

    await service.previewStudentImport(
      makeFile({ buffer, size: buffer.length }),
      'user-1',
    );

    expect(businessValidator.addBusinessErrors).toHaveBeenCalledTimes(1);
    expect(businessValidator.addBusinessErrors).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ rowNumber: 2 })]),
      'org-1',
    );
  });

  it('respects a requested organizationId', async () => {
    const buffer = await buildXlsx(STUDENT_HEADERS, [
      [
        'ST001',
        'Nguyen A',
        'a@gmail.com',
        '0901234567',
        '2006-01-01',
        'MALE',
        'HN01',
      ],
    ]);

    await service.previewStudentImport(
      makeFile({ buffer, size: buffer.length }),
      'user-1',
      { organizationId: 'org-2' },
    );

    expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('membership.organizationId = :organizationId'),
      { organizationId: 'org-2' },
    );
  });

  describe('confirmStudentImport', () => {
    const confirmedJob = { id: 'job-1', organizationId: 'org-1', status: 'PREVIEW', totalRows: 2 };

    it('imports valid rows and reports partial success', async () => {
      importJobsRepository.findOne.mockResolvedValue(confirmedJob);
      importJobRowsRepository.find.mockResolvedValue([
        {
          id: 'row-1',
          importJobId: 'job-1',
          rowNumber: 2,
          normalizedData: {
            student_code: 'ST001',
            email: 'a@gmail.com',
            full_name: 'Nguyen A',
            branch_code: 'HN01',
          },
          status: 'PENDING',
        },
        {
          id: 'row-2',
          importJobId: 'job-1',
          rowNumber: 3,
          normalizedData: {
            student_code: 'ST002',
            email: 'dup@gmail.com',
            full_name: 'Nguyen B',
            branch_code: 'HN01',
          },
          status: 'PENDING',
        },
      ]);
      studentImportExecutor.execute
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new ConflictException('Email "dup@gmail.com" already exists'),
        );

      const result = await service.confirmStudentImport('job-1', 'user-1');

      expect(result.total).toBe(2);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.rows.find((r) => r.rowNumber === 2)?.status).toBe(
        'SUCCESS',
      );
      expect(result.rows.find((r) => r.rowNumber === 3)?.status).toBe('FAILED');
      expect(importJobRowsRepository.update).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({ status: 'SUCCESS' }),
      );
      expect(importJobRowsRepository.update).toHaveBeenCalledWith(
        'row-2',
        expect.objectContaining({
          status: 'FAILED',
          errors: [{ field: 'email', message: 'Email "dup@gmail.com" already exists' }],
        }),
      );
      expect(importJobsRepository.update).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          status: 'COMPLETED',
          successRows: 1,
          failedRows: 1,
        }),
      );
    });

    it('throws NotFound when the job belongs to another organization', async () => {
      importJobsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.confirmStudentImport('job-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a second confirm when the job is already processing', async () => {
      importJobsRepository.findOne.mockResolvedValue({
        ...confirmedJob,
        status: 'PROCESSING',
      });

      await expect(
        service.confirmStudentImport('job-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the job was already claimed by another request', async () => {
      importJobsRepository.findOne.mockResolvedValue(confirmedJob);
      importJobsRepository.update.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.confirmStudentImport('job-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns zero success when no valid rows exist', async () => {
      importJobsRepository.findOne.mockResolvedValue(confirmedJob);
      importJobRowsRepository.find.mockResolvedValue([]);

      const result = await service.confirmStudentImport('job-1', 'user-1');

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
