import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { TeacherExportService } from './teacher-export.service';
import { TeachersService } from '../teachers.service';
import { ExcelService } from '../../common/excel/excel.service';
import { ExcelExportWorksheet } from '../../common/excel/excel.types';
import { Teacher } from '../entities/teacher.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { ExportTeachersQueryDto } from '../dto/export-teachers-query.dto';
import {
  TEACHER_EXPORT_HEADERS,
  TEACHER_EXPORT_SHEET_NAME,
} from './teacher-export.types';

const organizationId = 'org-1';
const branchId = 'branch-1';
const actorUserId = 'user-manager';

function buildTeacher(
  overrides: Partial<Record<string, unknown>> = {},
): Teacher {
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
    id: 't-1',
    userId: 'u-1',
    organizationId,
    teacherCode: 'GV-001',
    specialization: 'Toán học',
    qualification: 'Cử nhân',
    bio: 'Giáo viên nhiều năm kinh nghiệm',
    hireDate: new Date('2020-03-15T00:00:00.000Z'),
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
  } as unknown as Teacher;
}

function buildQueryBuilder(getManyResult: Teacher[]) {
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

describe('TeacherExportService', () => {
  let service: TeacherExportService;
  let teachersService: {
    resolveOrganizationId: jest.Mock;
    assertIsAdminOrOwner: jest.Mock;
  };
  let excelService: {
    exportWorksheet: jest.Mock;
    writeWorkbook: jest.Mock;
  };
  let teachersRepository: { createQueryBuilder: jest.Mock };
  let branchesRepository: { findOneBy: jest.Mock };
  let queryBuilder: ReturnType<typeof buildQueryBuilder>;

  beforeEach(async () => {
    teachersService = {
      resolveOrganizationId: jest.fn().mockResolvedValue(organizationId),
      assertIsAdminOrOwner: jest.fn().mockResolvedValue(undefined),
    };
    excelService = {
      exportWorksheet: jest.fn().mockReturnValue({}),
      writeWorkbook: jest.fn().mockResolvedValue(Buffer.from('workbook-bytes')),
    };
    teachersRepository = { createQueryBuilder: jest.fn() };
    branchesRepository = { findOneBy: jest.fn() };
    queryBuilder = buildQueryBuilder([buildTeacher()]);
    teachersRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherExportService,
        { provide: TeachersService, useValue: teachersService },
        { provide: ExcelService, useValue: excelService },
        {
          provide: getRepositoryToken(Teacher),
          useValue: teachersRepository,
        },
        { provide: getRepositoryToken(Branch), useValue: branchesRepository },
      ],
    }).compile();

    service = module.get<TeacherExportService>(TeacherExportService);
  });

  describe('authorization', () => {
    it('resolves the organization context for the actor', async () => {
      await service.export(actorUserId, { organizationId });

      expect(teachersService.resolveOrganizationId).toHaveBeenCalledWith(
        actorUserId,
        organizationId,
      );
      expect(teachersService.assertIsAdminOrOwner).toHaveBeenCalledWith(
        actorUserId,
        organizationId,
      );
    });

    it('allows an owner to export', async () => {
      const result = await service.export(actorUserId, {});

      expect(result.buffer.equals(Buffer.from('workbook-bytes'))).toBe(true);
      expect(result.filename).toMatch(/^teachers-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('allows an admin to export', async () => {
      teachersService.assertIsAdminOrOwner.mockResolvedValue(undefined);

      await expect(service.export(actorUserId, {})).resolves.toBeDefined();
    });

    it('rejects a non-manager user', async () => {
      teachersService.assertIsAdminOrOwner.mockRejectedValue(
        new ForbiddenException(
          'Only an owner or admin can perform this action',
        ),
      );

      await expect(service.export(actorUserId, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a user with no membership in the organization', async () => {
      teachersService.resolveOrganizationId.mockRejectedValue(
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
        'teacher.organizationId = :organizationId',
        { organizationId },
      );
    });

    it('exports all teachers when no filters are provided', async () => {
      await service.export(actorUserId, {});

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    });

    it('applies a trimmed search filter', async () => {
      await service.export(actorUserId, { search: 'Nguyen' });

      const calls = queryBuilder.andWhere.mock.calls as unknown[][];
      const searchCall = calls.find((call) =>
        String(call[0]).includes('teacherCode'),
      );
      expect(searchCall).toBeDefined();
      expect(searchCall![1]).toEqual({ search: '%Nguyen%' });
    });

    it('treats an empty search as no search', async () => {
      await service.export(actorUserId, { search: '' });

      const calls = queryBuilder.andWhere.mock.calls as unknown[][];
      const searchCall = calls.find((call) =>
        String(call[0]).includes('teacherCode'),
      );
      expect(searchCall).toBeUndefined();
    });

    it('applies a status filter', async () => {
      await service.export(actorUserId, { status: 'INACTIVE' as const });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'teacher.status = :status',
        { status: 'INACTIVE' },
      );
    });

    it('applies a specialization filter', async () => {
      await service.export(actorUserId, { specialization: 'Toán học' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'teacher.specialization = :specialization',
        { specialization: 'Toán học' },
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
        {
          branchId,
        },
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
        specialization: 'Toán học',
        branchId,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'teacher.organizationId = :organizationId',
        { organizationId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(4);
    });

    it('does not apply pagination to the export query', async () => {
      await service.export(actorUserId, {});

      expect(queryBuilder.limit).not.toHaveBeenCalled();
      expect(queryBuilder.skip).not.toHaveBeenCalled();
    });

    it('does not load classes or other large relations', async () => {
      await service.export(actorUserId, {});

      const selectColumns = (
        queryBuilder.select.mock.calls as unknown[][]
      )[0][0] as string[];
      expect(selectColumns.some((c) => c.includes('class'))).toBe(false);
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
          name: TEACHER_EXPORT_SHEET_NAME,
          headers: [...TEACHER_EXPORT_HEADERS],
          wrapColumns: [5, 6, 9],
        }),
      );
      expect(excelService.writeWorkbook).toHaveBeenCalledTimes(1);
      const options = exportOptions();
      expect(Array.isArray(options.rows)).toBe(true);
      expect(Array.isArray(options.columnWidths)).toBe(true);
    });

    it('maps a teacher to human-readable columns', async () => {
      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows).toEqual([
        [
          'GV-001',
          'Nguyễn Văn A',
          'nguyenvana@gmail.com',
          'Toán học',
          'Cử nhân',
          'Giáo viên nhiều năm kinh nghiệm',
          '15/03/2020',
          'Nam',
          'Chi nhánh Hà Nội',
          'Đang hoạt động',
          '06/09/2026 08:30',
        ],
      ]);
    });

    it('handles date fields returned as strings from the database', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildTeacher({
          hireDate: '2020-03-15T00:00:00.000Z',
          createdAt: '2026-09-06T08:30:00.000Z',
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][6]).toBe('15/03/2020');
      expect(options.rows[0][10]).toBe('06/09/2026 08:30');
    });

    it('labels status with the display name', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildTeacher({ status: 'INACTIVE', branches: [] }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][9]).toBe('Ngừng hoạt động');
    });

    it('labels gender with the display name', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildTeacher({ gender: 'FEMALE' }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][7]).toBe('Nữ');
    });

    it('never includes password hash or authentication data', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildTeacher({
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
      expect(options.rows[0]).toHaveLength(TEACHER_EXPORT_HEADERS.length);
    });

    it('returns a valid workbook with only headers when no teachers match', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.headers).toEqual([...TEACHER_EXPORT_HEADERS]);
      expect(options.rows).toEqual([]);
      const result = await service.export(actorUserId, {});
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('joins multiple branch names with commas', async () => {
      queryBuilder.getMany.mockResolvedValue([
        buildTeacher({
          branches: [
            { id: 'b1', name: 'Hà Nội' },
            { id: 'b2', name: 'Đà Nẵng' },
          ],
        }),
      ]);

      await service.export(actorUserId, {});

      const options = exportOptions();
      expect(options.rows[0][8]).toBe('Hà Nội, Đà Nẵng');
    });
  });

  describe('helper functions (dto becomes validated elsewhere)', () => {
    it('exports a query object without organization id', async () => {
      const query: ExportTeachersQueryDto = {};
      await service.export(actorUserId, query);

      expect(teachersService.resolveOrganizationId).toHaveBeenCalledWith(
        actorUserId,
        undefined,
      );
    });
  });
});
