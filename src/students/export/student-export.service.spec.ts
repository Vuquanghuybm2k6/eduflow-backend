import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { StudentExportService } from './student-export.service';
import { StudentsService } from '../students.service';
import { ExcelService } from '../../common/excel/excel.service';
import { ExcelExportWorksheet } from '../../common/excel/excel.types';
import { Student } from '../entities/student.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { ExportStudentsQueryDto } from '../dto/export-students-query.dto';
import {
  STUDENT_EXPORT_HEADERS,
  STUDENT_EXPORT_SHEET_NAME,
} from './student-export.types';

const organizationId = 'org-1';
const branchId = 'branch-1';
const actorUserId = 'user-manager';

function buildStudent(
  overrides: Partial<Record<string, unknown>> = {},
): Student {
  const user = overrides.user as
    | {
        id?: string;
        fullName?: string;
        email?: string;
        gender?: string;
        passwordHash?: string;
        refreshTokens?: unknown[];
      }
    | undefined;
  return {
    id: 's-1',
    userId: 'u-1',
    organizationId,
    studentCode: 'HV-001',
    dateOfBirth: new Date('2020-03-15T00:00:00.000Z'),
    address: '12 Nguyễn Trãi, Hà Nội',
    status: 'ACTIVE',
    createdAt: new Date('2026-09-06T08:30:00.000Z'),
    updatedAt: new Date('2026-09-06T08:30:00.000Z'),
    user: {
      id: user?.id ?? 'u-1',
      fullName: user?.fullName ?? 'Nguyễn Văn A',
      email: user?.email ?? 'nguyenvana@gmail.com',
      gender: (overrides.gender as string) ?? user?.gender ?? 'MALE',
    },
    branches: [{ id: branchId, name: 'Chi nhánh Hà Nội' }],
    ...overrides,
  } as unknown as Student;
}

function buildQueryBuilder(getManyResult: Student[]) {
  return {
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
  };
}

describe('StudentExportService', () => {
  let service: StudentExportService;
  let studentsService: {
    resolveOrganizationId: jest.Mock;
    assertIsAdminOrOwner: jest.Mock;
  };
  let excelService: {
    exportWorksheet: jest.Mock;
    writeWorkbook: jest.Mock;
  };
  let studentsRepository: { createQueryBuilder: jest.Mock };
  let branchesRepository: { findOneBy: jest.Mock };
  let queryBuilder: ReturnType<typeof buildQueryBuilder>;

  beforeEach(async () => {
    studentsService = {
      resolveOrganizationId: jest.fn().mockResolvedValue(organizationId),
      assertIsAdminOrOwner: jest.fn().mockResolvedValue(undefined),
    };
    excelService = {
      exportWorksheet: jest.fn().mockReturnValue({}),
      writeWorkbook: jest.fn().mockResolvedValue(Buffer.from('workbook-bytes')),
    };
    studentsRepository = { createQueryBuilder: jest.fn() };
    branchesRepository = { findOneBy: jest.fn() };
    queryBuilder = buildQueryBuilder([buildStudent()]);
    studentsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentExportService,
        { provide: StudentsService, useValue: studentsService },
        { provide: ExcelService, useValue: excelService },
        {
          provide: getRepositoryToken(Student),
          useValue: studentsRepository,
        },
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
      ],
    }).compile();

    service = module.get<StudentExportService>(StudentExportService);
  });

  describe('authorization', () => {
    it('resolves the organization context for the actor', async () => {
      await service.export(actorUserId, { organizationId });

      expect(studentsService.resolveOrganizationId).toHaveBeenCalledWith(
        actorUserId,
        organizationId,
      );
      expect(studentsService.assertIsAdminOrOwner).toHaveBeenCalledWith(
        actorUserId,
        organizationId,
      );
    });

    it('allows an owner to export', async () => {
      const result = await service.export(actorUserId, {});

      expect(result.buffer.equals(Buffer.from('workbook-bytes'))).toBe(true);
      expect(result.filename).toMatch(/^students-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('allows an admin to export', async () => {
      studentsService.assertIsAdminOrOwner.mockResolvedValue(undefined);

      await expect(service.export(actorUserId, {})).resolves.toBeDefined();
    });

    it('rejects a non-manager user', async () => {
      studentsService.assertIsAdminOrOwner.mockRejectedValue(
        new ForbiddenException(
          'Only an owner or admin can perform this action',
        ),
      );

      await expect(service.export(actorUserId, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a user with no membership in the organization', async () => {
      studentsService.resolveOrganizationId.mockRejectedValue(
        new ForbiddenException(
          'User does not have access to this organization',
        ),
      );

      await expect(service.export(actorUserId, {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('filters', () => {
    it('scopes the query by the current organization', async () => {
      await service.export(actorUserId, {});

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId },
      );
    });

    it('exports all students when no filters are provided', async () => {
      await service.export(actorUserId, {});

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it('applies a trimmed search filter', async () => {
      await service.export(actorUserId, { search: 'Nguyen' });

      const calls = queryBuilder.andWhere.mock.calls as unknown[][];
      const searchCall = calls.find((call) =>
        String(call[0]).includes('studentCode'),
      );
      expect(searchCall).toBeDefined();
      expect(searchCall![1]).toEqual({ search: '%Nguyen%' });
    });

    it('treats an empty search as no search', async () => {
      await service.export(actorUserId, { search: '' });

      const calls = queryBuilder.andWhere.mock.calls as unknown[][];
      const searchCall = calls.find((call) =>
        String(call[0]).includes('studentCode'),
      );
      expect(searchCall).toBeUndefined();
    });

    it('applies a status filter', async () => {
      await service.export(actorUserId, { status: 'INACTIVE' as const });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'student.status = :status',
        { status: 'INACTIVE' },
      );
    });

    it('applies a gender filter', async () => {
      await service.export(actorUserId, { gender: 'FEMALE' as const });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.gender = :gender',
        { gender: 'FEMALE' },
      );
    });

    it('applies a valid branch filter', async () => {
      branchesRepository.findOneBy.mockResolvedValue({
        id: branchId,
        organizationId,
      });

      await service.export(actorUserId, { branchId });

      expect(branchesRepository.findOneBy).toHaveBeenCalledWith({
        id: branchId,
        organizationId,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'branch.id = :branchId',
        { branchId },
      );
    });

    it('combines all filters', async () => {
      branchesRepository.findOneBy.mockResolvedValue({
        id: branchId,
        organizationId,
      });

      await service.export(actorUserId, {
        search: 'Nguyen',
        status: 'ACTIVE' as const,
        gender: 'MALE' as const,
        branchId,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(4);
    });

    it('does not apply pagination to the export query', async () => {
      await service.export(actorUserId, {});

      expect(queryBuilder.limit).not.toHaveBeenCalled();
      expect(queryBuilder.skip).not.toHaveBeenCalled();
    });

    it('does not load enrollments or other large relations', async () => {
      await service.export(actorUserId, {});

      const selectColumns = (
        queryBuilder.select.mock.calls as unknown[][]
      )[0][0] as string[];
      expect(selectColumns.some((c) => c.includes('enrollment'))).toBe(false);
    });
  });

  describe('branch validation', () => {
    it('rejects a branch that belongs to another organization', async () => {
      branchesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.export(actorUserId, { branchId })).rejects.toThrow(
        NotFoundException,
      );
      expect(queryBuilder.getMany).not.toHaveBeenCalled();
    });
  });

  describe('workbook output', () => {
    function exportOptions(): ExcelExportWorksheet {
      return (
        excelService.exportWorksheet.mock.calls as unknown[][]
      )[0][0] as ExcelExportWorksheet;
    }

    it('returns a valid workbook with headers and rows', async () => {
      await service.export(actorUserId, {});

      expect(excelService.exportWorksheet).toHaveBeenCalledWith(
        expect.objectContaining({
          name: STUDENT_EXPORT_SHEET_NAME,
          headers: [...STUDENT_EXPORT_HEADERS],
          wrapColumns: [8],
        }),
      );
      expect(excelService.writeWorkbook).toHaveBeenCalledTimes(1);
      const options = exportOptions();
      expect(Array.isArray(options.rows)).toBe(true);
      expect(Array.isArray(options.columnWidths)).toBe(true);
    });

    it('maps a student to human-readable columns', async () => {
      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows).toEqual([
        [
          'HV-001',
          'Nguyễn Văn A',
          'nguyenvana@gmail.com',
          '15/03/2020',
          'Nam',
          'Chi nhánh Hà Nội',
          'Đang hoạt động',
          '12 Nguyễn Trãi, Hà Nội',
          '06/09/2026 08:30',
        ],
      ]);
    });

    it('handles date fields returned as strings from the database', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildStudent({
          dateOfBirth: '2020-03-15T00:00:00.000Z',
          createdAt: '2026-09-06T08:30:00.000Z',
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][3]).toBe('15/03/2020');
      expect(options.rows[0][8]).toBe('06/09/2026 08:30');
    });

    it('labels gender and status with display names', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildStudent({
          gender: 'FEMALE',
          status: 'INACTIVE',
          branches: [],
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][4]).toBe('Nữ');
      expect(options.rows[0][6]).toBe('Ngừng hoạt động');
    });

    it('never includes password hash or authentication data', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildStudent({
          user: {
            id: 'u-1',
            fullName: 'Nguyễn Văn B',
            email: 'b@gmail.com',
            passwordHash: 'super-secret-hash',
            refreshTokens: [{ token: 'refresh-secret-token' }],
          },
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      const serialized = JSON.stringify(options.rows);
      expect(serialized).not.toContain('super-secret-hash');
      expect(serialized).not.toContain('refresh-secret-token');
      expect(options.rows[0]).toHaveLength(STUDENT_EXPORT_HEADERS.length);
    });

    it('returns a valid workbook with only headers when no students match', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.headers).toEqual([...STUDENT_EXPORT_HEADERS]);
      expect(options.rows).toEqual([]);
      const result = await service.export(actorUserId, {});
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('joins multiple branch names with commas', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildStudent({
          branches: [
            { id: 'b1', name: 'Hà Nội' },
            { id: 'b2', name: 'Đà Nẵng' },
          ],
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][5]).toBe('Hà Nội, Đà Nẵng');
    });
  });

  describe('helper functions (dto becomes validated elsewhere)', () => {
    it('exports a query object without organization id', async () => {
      const query: ExportStudentsQueryDto = {};
      await service.export(actorUserId, query);

      expect(studentsService.resolveOrganizationId).toHaveBeenCalledWith(
        actorUserId,
        undefined,
      );
    });
  });
});
