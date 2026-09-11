import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ReportsService } from './reports.service';
import { Class } from '../classes/entities/class.entity';
import { Student } from '../students/entities/student.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

type QbMethod =
  | 'innerJoin'
  | 'innerJoinAndSelect'
  | 'leftJoin'
  | 'where'
  | 'andWhere'
  | 'select'
  | 'addSelect'
  | 'setParameters'
  | 'orderBy'
  | 'addOrderBy'
  | 'limit'
  | 'skip'
  | 'take'
  | 'getOne'
  | 'getRawOne'
  | 'getCount'
  | 'getMany'
  | 'getRawMany'
  | 'getManyAndCount';

function makeQb(terminalMethod: QbMethod, terminalResult: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    innerJoinAndSelect: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getOne: jest.fn(),
    getRawOne: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  Object.values(qb).forEach((fn) => {
    fn.mockReturnValue(qb);
  });
  qb[terminalMethod].mockResolvedValue(terminalResult);
  return qb;
}

describe('ReportsService', () => {
  let service: ReportsService;

  let classesRepo: Record<string, jest.Mock>;
  let studentsRepo: Record<string, jest.Mock>;
  let sessionsRepo: Record<string, jest.Mock>;
  let attendancesRepo: Record<string, jest.Mock>;
  let membershipsRepo: Record<string, jest.Mock>;
  let enrollmentsRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    classesRepo = { findOneBy: jest.fn() };
    studentsRepo = { findOneBy: jest.fn() };
    sessionsRepo = { createQueryBuilder: jest.fn() };
    attendancesRepo = { createQueryBuilder: jest.fn() };
    membershipsRepo = { createQueryBuilder: jest.fn() };
    enrollmentsRepo = { find: jest.fn(), findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Class),
          useValue: classesRepo,
        },
        {
          provide: getRepositoryToken(Student),
          useValue: studentsRepo,
        },
        {
          provide: getRepositoryToken(ClassSession),
          useValue: sessionsRepo,
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: attendancesRepo,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipsRepo,
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: enrollmentsRepo,
        },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  function mockMembership() {
    membershipsRepo.createQueryBuilder.mockReturnValue(
      makeQb('getOne', { organizationId: 'org-1' }),
    );
  }

  function mockClassFound() {
    classesRepo.findOneBy.mockResolvedValue({
      id: 'class-1',
      organizationId: 'org-1',
    });
  }

  function mockClassMissing() {
    classesRepo.findOneBy.mockResolvedValue(null);
  }

  function mockStudentFound() {
    studentsRepo.findOneBy.mockResolvedValue({
      id: 'student-1',
      organizationId: 'org-1',
    });
  }

  function mockStudentMissing() {
    studentsRepo.findOneBy.mockResolvedValue(null);
  }

  function mockEnrollmentClassIds(classIds: string[]) {
    enrollmentsRepo.find.mockResolvedValue(
      classIds.map((classId) => ({ classId })),
    );
  }

  describe('getClassAttendanceSummary', () => {
    it('returns attendanceRate null when there are no attendance records', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '0' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '0',
          present: '0',
          late: '0',
          absent: '0',
          excused: '0',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.totalSessions).toBe(12);
      expect(result.recordedSessions).toBe(0);
      expect(result.totalAttendance).toBe(0);
      expect(result.attendanceRate).toBeNull();
    });

    it('returns 100% when all records are PRESENT', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '10' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '100',
          present: '100',
          late: '0',
          absent: '0',
          excused: '0',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.present).toBe(100);
      expect(result.attendanceRate).toBe(100);
    });

    it('computes attendance rate as (present + late) / total * 100', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '10' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '100',
          present: '80',
          late: '10',
          absent: '10',
          excused: '0',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.present).toBe(80);
      expect(result.late).toBe(10);
      expect(result.absent).toBe(10);
      expect(result.attendanceRate).toBe(90);
    });

    it('treats EXCUSED as not attended in the rate', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '10' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '100',
          present: '50',
          late: '0',
          absent: '0',
          excused: '50',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.attendanceRate).toBe(50);
    });

    it('distinguishes total sessions from recorded sessions', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '10' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '150',
          present: '125',
          late: '10',
          absent: '10',
          excused: '5',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.totalSessions).toBe(12);
      expect(result.recordedSessions).toBe(10);
      expect(result.totalAttendance).toBe(150);
      expect(result.present).toBe(125);
      expect(result.late).toBe(10);
      expect(result.absent).toBe(10);
      expect(result.excused).toBe(5);
    });

    it('rejects a class that does not belong to the organization', async () => {
      mockMembership();
      mockClassMissing();

      await expect(
        service.getClassAttendanceSummary('user-1', 'class-other'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rounds the attendance rate to 2 decimals', async () => {
      mockMembership();
      mockClassFound();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 12));
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', { count: '10' }),
      );
      attendancesRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb('getRawOne', {
          totalAttendance: '8',
          present: '7',
          late: '0',
          absent: '1',
          excused: '0',
        }),
      );

      const result = await service.getClassAttendanceSummary(
        'user-1',
        'class-1',
      );

      expect(result.attendanceRate).toBe(87.5);
    });
  });

  describe('getStudentAttendanceSummary', () => {
    function mockBase(occurredSessions = 0) {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds(['class-1', 'class-2']);
      sessionsRepo.createQueryBuilder.mockReturnValue(
        makeQb('getCount', occurredSessions),
      );
    }

    it('aggregates attendance across all enrolled classes', async () => {
      mockBase(20);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '18',
          present: '14',
          late: '2',
          absent: '1',
          excused: '1',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.studentId).toBe('student-1');
      expect(result.totalSessions).toBe(20);
      expect(result.recordedSessions).toBe(18);
      expect(result.present).toBe(14);
      expect(result.late).toBe(2);
      expect(result.absent).toBe(1);
      expect(result.excused).toBe(1);
    });

    it('computes attendedSessions = present + late and missedSessions = absent + excused', async () => {
      mockBase(20);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '18',
          present: '14',
          late: '2',
          absent: '1',
          excused: '1',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.attendedSessions).toBe(16);
      expect(result.missedSessions).toBe(2);
      expect(result.attendanceRate).toBe(88.89);
    });

    it('returns a null rate when nothing has been recorded', async () => {
      mockBase(20);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '0',
          present: '0',
          late: '0',
          absent: '0',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.totalSessions).toBe(20);
      expect(result.recordedSessions).toBe(0);
      expect(result.attendanceRate).toBeNull();
    });

    it('never counts unrecorded sessions as ABSENT', async () => {
      mockBase(20);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '18',
          present: '15',
          late: '2',
          absent: '1',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.totalSessions).toBe(20);
      expect(result.recordedSessions).toBe(18);
      expect(result.absent).toBe(1);
      expect(result.missedSessions).toBe(1);
    });

    it('counts only PRESENT records', async () => {
      mockBase(10);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '10',
          present: '10',
          late: '0',
          absent: '0',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.present).toBe(10);
      expect(result.attendanceRate).toBe(100);
    });

    it('counts LATE records as attended', async () => {
      mockBase(10);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '10',
          present: '8',
          late: '2',
          absent: '0',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.late).toBe(2);
      expect(result.attendedSessions).toBe(10);
    });

    it('counts ABSENT records', async () => {
      mockBase(10);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '10',
          present: '5',
          late: '0',
          absent: '5',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.absent).toBe(5);
      expect(result.missedSessions).toBe(5);
      expect(result.attendanceRate).toBe(50);
    });

    it('counts EXCUSED records as missed', async () => {
      mockBase(10);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '10',
          present: '7',
          late: '0',
          absent: '0',
          excused: '3',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.excused).toBe(3);
      expect(result.missedSessions).toBe(3);
      expect(result.attendanceRate).toBe(70);
    });

    it('excludes future sessions from totalSessions', async () => {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds(['class-1']);
      const qb = makeQb('getCount', 20);
      sessionsRepo.createQueryBuilder.mockReturnValue(qb);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '18',
          present: '14',
          late: '2',
          absent: '1',
          excused: '1',
        }),
      );

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.totalSessions).toBe(20);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('sessionDate'),
        expect.any(Object),
      );
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('returns an empty summary when the student has no enrollments', async () => {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds([]);

      const result = await service.getStudentAttendanceSummary(
        'user-1',
        'student-1',
      );

      expect(result.totalSessions).toBe(0);
      expect(result.recordedSessions).toBe(0);
      expect(result.attendanceRate).toBeNull();
      expect(sessionsRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(attendancesRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects a student from another organization', async () => {
      mockMembership();
      mockStudentMissing();

      await expect(
        service.getStudentAttendanceSummary('user-1', 'student-other'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudentAttendanceSummaryForClass', () => {
    function mockClassEnrolled() {
      classesRepo.findOneBy.mockResolvedValue({
        id: 'class-1',
        organizationId: 'org-1',
      });
      enrollmentsRepo.findOneBy.mockResolvedValue({
        studentId: 'student-1',
        classId: 'class-1',
        status: 'COMPLETED',
      });
    }

    it('computes the summary for a single class', async () => {
      mockMembership();
      mockStudentFound();
      mockClassEnrolled();
      sessionsRepo.createQueryBuilder.mockReturnValue(makeQb('getCount', 10));
      attendancesRepo.createQueryBuilder.mockReturnValue(
        makeQb('getRawOne', {
          recordedSessions: '10',
          present: '8',
          late: '1',
          absent: '1',
          excused: '0',
        }),
      );

      const result = await service.getStudentAttendanceSummaryForClass(
        'user-1',
        'student-1',
        'class-1',
      );

      expect(result.totalSessions).toBe(10);
      expect(result.recordedSessions).toBe(10);
      expect(result.attendedSessions).toBe(9);
      expect(result.attendanceRate).toBe(90);
    });

    it('rejects when the student is not enrolled in the class', async () => {
      mockMembership();
      mockStudentFound();
      classesRepo.findOneBy.mockResolvedValue({
        id: 'class-1',
        organizationId: 'org-1',
      });
      enrollmentsRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.getStudentAttendanceSummaryForClass(
          'user-1',
          'student-1',
          'class-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the class belongs to another organization', async () => {
      mockMembership();
      mockStudentFound();
      classesRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.getStudentAttendanceSummaryForClass(
          'user-1',
          'student-1',
          'class-other',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudentAttendanceHistory', () => {
    function mockHistoryRows(rows: unknown[]) {
      sessionsRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb('getCount', rows.length))
        .mockReturnValueOnce(makeQb('getRawMany', rows));
    }

    it('returns session rows with class info', async () => {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds(['class-1']);
      mockHistoryRows([
        {
          sessionId: 's-2',
          classId: 'class-1',
          className: 'IELTS 6.5',
          date: new Date('2026-09-17T00:00:00.000Z'),
          startTime: '18:00',
          endTime: '20:00',
          status: 'PRESENT',
          note: null,
        },
      ]);

      const result = await service.getStudentAttendanceHistory(
        'user-1',
        'student-1',
      );

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.items[0]).toEqual({
        sessionId: 's-2',
        classId: 'class-1',
        className: 'IELTS 6.5',
        date: '2026-09-17',
        startTime: '18:00',
        endTime: '20:00',
        status: 'PRESENT',
        note: null,
      });
    });

    it('represents a session without an attendance record as a null status', async () => {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds(['class-1']);
      mockHistoryRows([
        {
          sessionId: 's-1',
          classId: 'class-1',
          className: 'IELTS 6.5',
          date: '2026-09-17',
          startTime: '18:00',
          endTime: '20:00',
          status: null,
          note: null,
        },
      ]);

      const result = await service.getStudentAttendanceHistory(
        'user-1',
        'student-1',
      );

      expect(result.items[0].status).toBeNull();
    });

    it('applies pagination and a class filter', async () => {
      mockMembership();
      mockStudentFound();
      classesRepo.findOneBy.mockResolvedValue({
        id: 'class-1',
        organizationId: 'org-1',
      });
      enrollmentsRepo.findOneBy.mockResolvedValue({
        studentId: 'student-1',
        classId: 'class-1',
        status: 'ACTIVE',
      });
      mockHistoryRows([]);

      const result = await service.getStudentAttendanceHistory(
        'user-1',
        'student-1',
        { classId: 'class-1', page: 2, limit: 10 },
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.items).toEqual([]);
      expect(classesRepo.findOneBy).toHaveBeenCalledWith({
        id: 'class-1',
        organizationId: 'org-1',
      });
    });

    it('returns an empty history when there are no enrollments', async () => {
      mockMembership();
      mockStudentFound();
      mockEnrollmentClassIds([]);

      const result = await service.getStudentAttendanceHistory(
        'user-1',
        'student-1',
      );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(sessionsRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('rejects a student from another organization', async () => {
      mockMembership();
      mockStudentMissing();

      await expect(
        service.getStudentAttendanceHistory('user-1', 'student-other'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('tenant isolation', () => {
    it('forbids access when the membership cannot be resolved', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        makeQb('getOne', null),
      );

      await expect(
        service.getClassAttendanceSummary('user-1', 'class-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
