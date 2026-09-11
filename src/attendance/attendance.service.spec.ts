import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AttendanceService } from './attendance.service';
import { Attendance } from './entities/attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { ClassSessionStatus } from '../sessions/enums/class-session-status.enum';
import { Membership } from '../memberships/entities/membership.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity';
import { Teacher, TeacherStatus } from '../teachers/entities/teacher.entity';

function makeMembershipQb(result: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getOne: jest.fn(),
  };
  Object.values(qb).forEach((fn) => {
    if (fn !== qb.getOne) {
      fn.mockReturnValue(qb);
    }
  });
  qb.getOne.mockResolvedValue(result);
  return qb;
}

function makeEnrollmentQb(result: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn(),
  };
  Object.values(qb).forEach((fn) => {
    if (fn !== qb.getMany) {
      fn.mockReturnValue(qb);
    }
  });
  qb.getMany.mockResolvedValue(result);
  return qb;
}

function makeSession(
  overrides: {
    status?: ClassSessionStatus;
    classTeacherId?: string | null;
  } = {},
) {
  const {
    status = ClassSessionStatus.SCHEDULED,
    classTeacherId = 'teacher-1',
  } = overrides;
  return {
    id: 'session-1',
    classId: 'class-1',
    organizationId: 'org-1',
    sessionDate: new Date('2026-09-18T00:00:00.000Z'),
    startTime: '19:00:00',
    endTime: '21:00:00',
    status,
    type: 'REGULAR',
    room: 'A101',
    class: {
      id: 'class-1',
      name: 'Java Basic',
      code: 'JAVA01',
      organizationId: 'org-1',
      teacherId: classTeacherId,
      teacher: {
        id: 'teacher-1',
        user: { fullName: 'Nguyen Van A' },
      },
    },
  };
}

function makeEnrollment(
  studentId: string,
  studentCode: string,
  fullName: string,
) {
  return {
    studentId,
    student: {
      id: studentId,
      studentCode,
      organizationId: 'org-1',
      user: { fullName },
    },
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;

  let dataSource: { transaction: jest.Mock };
  let attendancesRepo: Record<string, jest.Mock>;
  let sessionsRepo: Record<string, jest.Mock>;
  let membershipsRepo: Record<string, jest.Mock>;
  let enrollmentsRepo: Record<string, jest.Mock>;
  let teachersRepo: Record<string, jest.Mock>;

  let enrollmentQb: ReturnType<typeof makeEnrollmentQb>;

  const teacher = {
    id: 'teacher-1',
    organizationId: 'org-1',
    userId: 'user-1',
    status: TeacherStatus.ACTIVE,
  };

  const txManager = {
    getRepository: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const membershipQb = makeMembershipQb({ organizationId: 'org-1' });

    dataSource = { transaction: jest.fn() };
    attendancesRepo = {
      find: jest.fn(),
      create: jest.fn((data: object) => ({ id: 'att-new', ...data })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    sessionsRepo = { findOne: jest.fn() };
    membershipsRepo = {
      createQueryBuilder: jest.fn(() => membershipQb),
      findOne: jest.fn(),
    };
    teachersRepo = { findOne: jest.fn() };
    enrollmentQb = makeEnrollmentQb([]);
    enrollmentsRepo = {
      createQueryBuilder: jest.fn(() => enrollmentQb),
      countBy: jest.fn(),
    };

    txManager.getRepository.mockImplementation(() => txManager);
    txManager.findOne.mockResolvedValue(null);
    txManager.create.mockImplementation((data: object) => ({
      id: 'att-new',
      ...data,
    }));
    txManager.save.mockImplementation((entity: unknown) =>
      Promise.resolve(entity),
    );
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<unknown>) => cb(txManager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Attendance), useValue: attendancesRepo },
        { provide: getRepositoryToken(ClassSession), useValue: sessionsRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentsRepo },
        { provide: getRepositoryToken(Teacher), useValue: teachersRepo },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSessionAttendance', () => {
    beforeEach(() => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      attendancesRepo.find.mockResolvedValue([]);
      enrollmentQb.getMany.mockResolvedValue([
        makeEnrollment('s-1', 'SV001', 'Nguyen Van B'),
        makeEnrollment('s-2', 'SV002', 'Tran Van C'),
      ]);
    });

    it('lets an OWNER view attendance of a session in their organization', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Organization Owner' },
      });

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(result.role).toBe('manager');
      expect(result.students).toHaveLength(2);
      expect(result.class).toEqual({
        id: 'class-1',
        name: 'Java Basic',
        code: 'JAVA01',
      });
    });

    it('lets an ADMIN view attendance of a session in their organization', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Admin' },
      });

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(result.role).toBe('manager');
      expect(result.students).toHaveLength(2);
      expect(teachersRepo.findOne).not.toHaveBeenCalled();
    });

    it('lets a TEACHER view attendance of a class they teach', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Teacher' },
      });
      teachersRepo.findOne.mockResolvedValue(teacher);

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(result.role).toBe('teacher');
      expect(result.teacher).toEqual({ id: 'teacher-1', name: 'Nguyen Van A' });
    });

    it('rejects a TEACHER who does not teach that class', async () => {
      sessionsRepo.findOne.mockResolvedValue(
        makeSession({ classTeacherId: 'teacher-2' }),
      );
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Teacher' },
      });
      teachersRepo.findOne.mockResolvedValue(teacher);

      await expect(
        service.getSessionAttendance('user-1', 'session-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a session that belongs to another organization', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getSessionAttendance('user-1', 'session-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns only ACTIVE enrolled students of the class', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Admin' },
      });
      enrollmentQb.getMany.mockResolvedValue([
        makeEnrollment('s-1', 'SV001', 'Nguyen Van B'),
      ]);

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(enrollmentQb.where).toHaveBeenCalledWith(
        'enrollment.classId = :classId',
        { classId: 'class-1' },
      );
      expect(enrollmentQb.andWhere).toHaveBeenCalledWith(
        'enrollment.status = :status',
        { status: EnrollmentStatus.ACTIVE },
      );
      expect(result.students).toHaveLength(1);
      expect(result.students[0].studentCode).toBe('SV001');
    });

    it('returns attendance = null for students that were never marked', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Admin' },
      });
      attendancesRepo.find.mockResolvedValue([]);

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(result.students[0].attendance).toBeNull();
    });

    it('returns the existing attendance record including who marked it', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Admin' },
      });
      attendancesRepo.find.mockResolvedValue([
        {
          id: 'att-1',
          studentId: 's-1',
          status: AttendanceStatus.PRESENT,
          note: null,
          markedAt: new Date('2026-09-18T12:00:00.000Z'),
          markedBy: { id: 'teacher-1', fullName: 'Nguyen Van A' },
        },
      ]);

      const result = await service.getSessionAttendance('user-1', 'session-1');

      expect(result.students[0].attendance).toEqual({
        id: 'att-1',
        status: AttendanceStatus.PRESENT,
        note: null,
        markedAt: '2026-09-18T12:00:00.000Z',
        markedBy: { id: 'teacher-1', name: 'Nguyen Van A' },
      });
    });

    it('rejects a STUDENT role', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Student' },
      });

      await expect(
        service.getSessionAttendance('user-1', 'session-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('updateSessionAttendance', () => {
    const dto = {
      records: [
        { studentId: 's-1', status: AttendanceStatus.PRESENT, note: null },
      ],
    };

    beforeEach(() => {
      sessionsRepo.findOne.mockResolvedValue(makeSession());
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Teacher' },
      });
      teachersRepo.findOne.mockResolvedValue(teacher);
      enrollmentsRepo.createQueryBuilder.mockReturnValue(
        makeEnrollmentQb([makeEnrollment('s-1', 'SV001', 'Nguyen Van B')]),
      );
      enrollmentsRepo.countBy.mockResolvedValue(2);
      attendancesRepo.find.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
      ]);
    });

    it('lets a TEACHER mark attendance for their own class', async () => {
      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(txManager.create).toHaveBeenCalledWith({
        organizationId: 'org-1',
        sessionId: 'session-1',
        studentId: 's-1',
        status: AttendanceStatus.PRESENT,
        note: null,
        markedById: 'user-1',
        markedAt: expect.any(Date) as Date,
      });
      expect(result).toEqual({
        sessionId: 'session-1',
        totalStudents: 2,
        present: 1,
        absent: 0,
        late: 0,
        excused: 0,
      });
    });

    it('updates an existing attendance record instead of creating a duplicate', async () => {
      const existing = {
        id: 'att-1',
        sessionId: 'session-1',
        studentId: 's-1',
        status: AttendanceStatus.ABSENT,
        note: 'Nghỉ không phép',
        markedById: 'user-old',
      };
      txManager.findOne.mockResolvedValue(existing);

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(txManager.create).not.toHaveBeenCalled();
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'att-1',
          status: AttendanceStatus.PRESENT,
          markedById: 'user-1',
          markedAt: expect.any(Date) as Date,
        }),
      );
      expect(result.totalStudents).toBe(2);
    });

    it('handles a concurrent duplicate-key race by updating the raced row', async () => {
      txManager.findOne.mockResolvedValueOnce(null);
      const raced = {
        id: 'att-1',
        sessionId: 'session-1',
        studentId: 's-1',
        status: AttendanceStatus.ABSENT,
      };
      txManager.findOne.mockResolvedValueOnce(raced);
      const uniqueViolation = Object.assign(new Error('unique_violation'), {
        code: '23505',
      });
      txManager.create.mockImplementation(() => {
        throw uniqueViolation;
      });

      await service.updateSessionAttendance('user-1', 'session-1', dto);

      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'att-1',
          status: AttendanceStatus.PRESENT,
          markedById: 'user-1',
        }),
      );
    });

    it('applies all changes inside one transaction', async () => {
      const bulkDto = {
        records: [
          { studentId: 's-1', status: AttendanceStatus.PRESENT, note: null },
          { studentId: 's-2', status: AttendanceStatus.LATE, note: 'Đến muộn' },
        ],
      };
      enrollmentsRepo.createQueryBuilder.mockReturnValue(
        makeEnrollmentQb([
          makeEnrollment('s-1', 'SV001', 'Nguyen Van B'),
          makeEnrollment('s-2', 'SV002', 'Tran Van C'),
        ]),
      );
      enrollmentsRepo.countBy.mockResolvedValue(2);
      attendancesRepo.find.mockResolvedValue([
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.LATE },
      ]);

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        bulkDto,
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txManager.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        sessionId: 'session-1',
        totalStudents: 2,
        present: 1,
        absent: 0,
        late: 1,
        excused: 0,
      });
    });

    it('rejects a TEACHER who does not teach that class', async () => {
      sessionsRepo.findOne.mockResolvedValue(
        makeSession({ classTeacherId: 'teacher-2' }),
      );

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an OWNER mark attendance of any class in the organization', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Organization Owner' },
      });

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(teachersRepo.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.totalStudents).toBe(2);
    });

    it('lets an ADMIN mark attendance of any class in the organization', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Admin' },
      });

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(teachersRepo.findOne).not.toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.totalStudents).toBe(2);
    });

    it('lets an OWNER mark a class taught by another teacher', async () => {
      sessionsRepo.findOne.mockResolvedValue(
        makeSession({ classTeacherId: 'teacher-2' }),
      );
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Organization Owner' },
      });

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.totalStudents).toBe(2);
    });

    it('rejects a STUDENT who tries to mark attendance', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        organizationId: 'org-1',
        role: { name: 'Student' },
      });

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a student who is not enrolled in the class', async () => {
      enrollmentsRepo.createQueryBuilder.mockReturnValue(
        makeEnrollmentQb([makeEnrollment('s-2', 'SV002', 'Tran Van C')]),
      );

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a student who belongs to another organization', async () => {
      enrollmentsRepo.createQueryBuilder.mockReturnValue(makeEnrollmentQb([]));

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects marking a CANCELLED session', async () => {
      sessionsRepo.findOne.mockResolvedValue(
        makeSession({ status: ClassSessionStatus.CANCELLED }),
      );

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('allows correcting attendance of a COMPLETED session', async () => {
      sessionsRepo.findOne.mockResolvedValue(
        makeSession({ status: ClassSessionStatus.COMPLETED }),
      );

      const result = await service.updateSessionAttendance(
        'user-1',
        'session-1',
        dto,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.totalStudents).toBe(2);
    });

    it('rejects a session that belongs to another organization', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSessionAttendance('user-1', 'session-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
