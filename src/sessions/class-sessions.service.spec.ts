import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ClassSessionsService } from './class-sessions.service';
import { ClassSession } from './entities/class-session.entity';
import { ClassSessionStatus } from './enums/class-session-status.enum';
import { ClassSessionType } from './enums/class-session-type.enum';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { DayOfWeek, Schedule } from '../schedules/entities/schedule.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Attendance } from '../attendance/entities/attendance.entity';

const userId = 'user-1';
const organizationId = 'org-1';
const classId = 'class-1';
const teacherId = 'teacher-1';

function buildMembershipQueryBuilderMock(
  organization: string | null = organizationId,
) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest
      .fn()
      .mockResolvedValue(
        organization ? { organizationId: organization } : null,
      ),
  };
}

function buildSessionQueryBuilderMock() {
  return {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

function buildAttendanceQueryBuilderMock(rows: { sessionId: string }[] = []) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

function buildActiveClass(overrides: Partial<Class> = {}): Class {
  return {
    id: classId,
    organizationId,
    teacherId,
    name: 'Math A',
    code: 'MATH-A',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: ClassStatus.ACTIVE,
    lifecycleStatus: ClassLifecycleStatus.UPCOMING,
    ...overrides,
  } as Class;
}

function buildMondaySchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    classId,
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: '18:00:00',
    endTime: '20:00:00',
    room: 'A1',
    ...overrides,
  } as Schedule;
}

describe('ClassSessionsService', () => {
  let service: ClassSessionsService;
  let classSessionsRepo: jest.Mocked<Partial<Repository<ClassSession>>>;
  let classesRepo: jest.Mocked<Partial<Repository<Class>>>;
  let schedulesRepo: jest.Mocked<Partial<Repository<Schedule>>>;
  let membershipsRepo: jest.Mocked<Partial<Repository<Membership>>>;
  let attendancesRepo: jest.Mocked<Partial<Repository<Attendance>>>;

  beforeEach(async () => {
    membershipsRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(buildMembershipQueryBuilderMock()),
      findOne: jest.fn().mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Owner' },
      }),
    };

    classesRepo = {
      findOneBy: jest.fn().mockResolvedValue(buildActiveClass()),
    };

    schedulesRepo = {
      find: jest.fn().mockResolvedValue([buildMondaySchedule()]),
    };

    classSessionsRepo = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => buildSessionQueryBuilderMock()),
    };

    attendancesRepo = {
      createQueryBuilder: jest.fn(() => buildAttendanceQueryBuilderMock()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassSessionsService,
        {
          provide: getRepositoryToken(ClassSession),
          useValue: classSessionsRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classesRepo },
        { provide: getRepositoryToken(Schedule), useValue: schedulesRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Attendance), useValue: attendancesRepo },
      ],
    }).compile();

    service = module.get<ClassSessionsService>(ClassSessionsService);
  });

  describe('authorization & tenancy', () => {
    it('rejects when the user has no active membership for the organization', async () => {
      membershipsRepo.createQueryBuilder.mockReturnValue(
        buildMembershipQueryBuilderMock(null),
      );

      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-05',
          endDate: '2026-01-11',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the user is not an owner or admin', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Teacher' },
      });

      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-05',
          endDate: '2026-01-11',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the membership has no role', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: null,
      });

      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-05',
          endDate: '2026-01-11',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('accepts an admin membership', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Admin' },
      });

      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-05',
          endDate: '2026-01-11',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('generate', () => {
    const dto = { startDate: '2026-01-05', endDate: '2026-01-11' };

    it('creates a session for each matching weekday in the range', async () => {
      const result = await service.generate(userId, classId, dto);

      expect(result).toEqual({
        classId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        created: 1,
        skipped: 0,
      });
      expect(classSessionsRepo.create).toHaveBeenCalledTimes(1);
      expect(classSessionsRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skips dates that already have a session', async () => {
      const qb = buildSessionQueryBuilderMock();
      qb.getRawMany.mockResolvedValue([
        { sessionDate: '2026-01-04' },
        { sessionDate: '2026-01-05' },
      ]);
      classSessionsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.generate(userId, classId, dto);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(classSessionsRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the class does not exist', async () => {
      classesRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.generate(userId, classId, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the class is inactive', async () => {
      classesRepo.findOneBy.mockResolvedValue(
        buildActiveClass({ status: ClassStatus.INACTIVE }),
      );

      await expect(
        service.generate(userId, classId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the class is cancelled', async () => {
      classesRepo.findOneBy.mockResolvedValue(
        buildActiveClass({ lifecycleStatus: ClassLifecycleStatus.CANCELLED }),
      );

      await expect(
        service.generate(userId, classId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the class has no teacher assigned', async () => {
      classesRepo.findOneBy.mockResolvedValue(
        buildActiveClass({ teacherId: null }),
      );

      await expect(
        service.generate(userId, classId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid start date', async () => {
      await expect(
        service.generate(userId, classId, {
          startDate: 'not-a-date',
          endDate: '2026-01-11',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid end date', async () => {
      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-05',
          endDate: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when startDate is after endDate', async () => {
      await expect(
        service.generate(userId, classId, {
          startDate: '2026-02-01',
          endDate: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a range longer than 366 days', async () => {
      await expect(
        service.generate(userId, classId, {
          startDate: '2026-01-01',
          endDate: '2027-06-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the class has no schedule', async () => {
      schedulesRepo.find.mockResolvedValue([]);

      await expect(
        service.generate(userId, classId, dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns an empty result when the range is outside the class window', async () => {
      classesRepo.findOneBy.mockResolvedValue(
        buildActiveClass({
          startDate: new Date('2030-01-01'),
          endDate: new Date('2030-12-31'),
        }),
      );

      const result = await service.generate(userId, classId, {
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(classSessionsRepo.save).not.toHaveBeenCalled();
    });

    it('falls back to per-row inserts when the bulk insert hits a duplicate key', async () => {
      classSessionsRepo.save.mockRejectedValue({
        driverError: { code: '23505' },
      });

      const result = await service.generate(userId, classId, {
        startDate: '2026-01-05',
        endDate: '2026-01-19',
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(3);
    });

    it('rethrows non-duplicate database errors', async () => {
      classSessionsRepo.save.mockRejectedValue(new Error('database down'));

      await expect(service.generate(userId, classId, dto)).rejects.toThrow(
        'database down',
      );
    });
  });

  describe('findAll', () => {
    const session = {
      id: 'session-1',
      classId,
      scheduleId: 'sched-1',
      teacherId,
      sessionDate: new Date('2026-01-05'),
      startTime: '18:00:00',
      endTime: '20:00:00',
      room: 'A1',
      type: ClassSessionType.REGULAR,
      status: ClassSessionStatus.SCHEDULED,
      note: null,
      teacher: { id: teacherId, user: { fullName: 'Teacher One' } },
    } as any;

    it('maps sessions to the API response shape', async () => {
      const qb = buildSessionQueryBuilderMock();
      qb.getMany.mockResolvedValue([session]);
      classSessionsRepo.createQueryBuilder.mockReturnValue(qb);
      attendancesRepo.createQueryBuilder.mockReturnValue(
        buildAttendanceQueryBuilderMock([{ sessionId: 'session-1' }]),
      );

      const result = await service.findAll(userId, classId, {});

      expect(result).toEqual([
        {
          id: 'session-1',
          classId,
          scheduleId: 'sched-1',
          teacherId,
          sessionDate: '2026-01-05',
          startTime: '18:00',
          endTime: '20:00',
          room: 'A1',
          type: ClassSessionType.REGULAR,
          status: ClassSessionStatus.SCHEDULED,
          note: null,
          teacher: { id: teacherId, name: 'Teacher One' },
          hasAttendance: true,
        },
      ]);
    });

    it('applies status and date filters', async () => {
      const qb = buildSessionQueryBuilderMock();
      classSessionsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(userId, classId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        status: ClassSessionStatus.COMPLETED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('session.status = :status', {
        status: ClassSessionStatus.COMPLETED,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.session_date >= :startDate',
        { startDate: '2026-01-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'session.session_date <= :endDate',
        { endDate: '2026-01-31' },
      );
    });

    it('returns null teacher when the teacher has no user', async () => {
      const qb = buildSessionQueryBuilderMock();
      qb.getMany.mockResolvedValue([{ ...session, teacher: null }]);
      classSessionsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(userId, classId, {});

      expect(result[0].teacher).toBeNull();
      expect(result[0].hasAttendance).toBe(false);
    });

    it('rejects when the class does not exist', async () => {
      classesRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findAll(userId, classId, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the session with its class, course and schedule', async () => {
      classSessionsRepo.findOne.mockResolvedValue({
        id: 'session-1',
        classId,
        scheduleId: 'sched-1',
        teacherId,
        sessionDate: new Date('2026-01-05'),
        startTime: '18:00:00',
        endTime: '20:00:00',
        room: 'A1',
        type: ClassSessionType.REGULAR,
        status: ClassSessionStatus.SCHEDULED,
        note: 'note',
        teacher: { id: teacherId, user: { fullName: 'Teacher One' } },
        class: {
          id: classId,
          name: 'Math A',
          code: 'MATH-A',
          course: { id: 'course-1', name: 'Math' },
        },
        schedule: {
          id: 'sched-1',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00:00',
          endTime: '20:00:00',
          room: 'A1',
        },
      } as any);

      const result = await service.findOne(userId, classId, 'session-1');

      expect(result).toMatchObject({
        id: 'session-1',
        sessionDate: '2026-01-05',
        startTime: '18:00',
        class: { id: classId, name: 'Math A', code: 'MATH-A' },
        course: { id: 'course-1', name: 'Math' },
        schedule: {
          id: 'sched-1',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        },
      });
    });

    it('rejects when the session does not exist', async () => {
      classSessionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(userId, classId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
