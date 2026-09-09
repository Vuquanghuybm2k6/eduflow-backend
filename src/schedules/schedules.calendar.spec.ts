import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  FindManyOptions,
  FindOneOptions,
  QueryBuilder,
} from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { SchedulesService, type CalendarResponse } from './schedules.service';
import { DayOfWeek, Schedule } from './entities/schedule.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Course } from '../courses/entities/course.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

const userId = 'user-1';
const organizationId = 'org-1';

type MembershipRepoMock = {
  findOne: jest.Mock<
    (options?: FindOneOptions<Membership>) => Promise<Membership | null>
  >;
  createQueryBuilder: jest.Mock<(alias: string) => QueryBuilder<Membership>>;
};

type ScheduleRepoMock = {
  createQueryBuilder: jest.Mock<(alias: string) => QueryBuilder<Schedule>>;
};

type TeacherRepoMock = {
  findOne: jest.Mock<
    (options?: FindOneOptions<Teacher>) => Promise<Teacher | null>
  >;
};

type StudentRepoMock = {
  findOne: jest.Mock<
    (options?: FindOneOptions<Student>) => Promise<Student | null>
  >;
};

type EnrollmentRepoMock = {
  find: jest.Mock<
    (options?: FindManyOptions<Enrollment>) => Promise<Enrollment[]>
  >;
};

interface CalendarQb {
  innerJoinAndSelect(_alias: string, _relation: string): CalendarQb;
  leftJoinAndSelect(_alias: string, _relation: string): CalendarQb;
  where(_clause: string, _params?: Record<string, unknown>): CalendarQb;
  andWhere(_clause: string, _params?: Record<string, unknown>): CalendarQb;
  orderBy(_clause: string, _direction?: string): CalendarQb;
  addOrderBy(_clause: string, _direction?: string): CalendarQb;
  getMany(): Promise<unknown[]>;
}

function makeQueryBuilder(getManyResult: unknown[] = []) {
  let whereArgs: Record<string, unknown> = {};
  const andWhereCalls: Record<string, unknown>[] = [];

  const qb = {
    innerJoinAndSelect: jest.fn((_alias: string, _relation: string) => qb),
    leftJoinAndSelect: jest.fn((_alias: string, _relation: string) => qb),
    where: jest.fn((_clause: string, _params?: Record<string, unknown>) => {
      whereArgs = _params ?? {};
      return qb;
    }),
    andWhere: jest.fn((_clause: string, _params?: Record<string, unknown>) => {
      andWhereCalls.push(_params ?? {});
      return qb;
    }),
    orderBy: jest.fn((_clause: string, _direction?: string) => qb),
    addOrderBy: jest.fn((_clause: string, _direction?: string) => qb),
    getMany: jest.fn(() => Promise.resolve(getManyResult)),
  } as CalendarQb;

  return {
    qb: qb as unknown as QueryBuilder<Schedule>,
    whereArgs: (): Record<string, unknown> => whereArgs,
    andWhereCalls: (): Record<string, unknown>[] => andWhereCalls,
  };
}

const teacherUser = { fullName: 'Nguyen Van A' };
const teacher = { id: 'teacher-1', userId, organizationId, user: teacherUser };
const branch = { id: 'branch-1', organizationId, name: 'Ha Noi' };
const course = { id: 'course-1', organizationId, name: 'Java' };

function makeClassEntity(overrides: Partial<Class> = {}): Class {
  return {
    id: 'class-1',
    organizationId,
    branchId: 'branch-1',
    courseId: 'course-1',
    teacherId: 'teacher-1',
    name: 'Java Basic',
    code: 'JAVA01',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-10-01T00:00:00.000Z'),
    status: ClassStatus.ACTIVE,
    lifecycleStatus: ClassLifecycleStatus.ONGOING,
    branch,
    course,
    teacher,
    ...overrides,
  } as Class;
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  const classEntity = makeClassEntity();
  return {
    id: 'schedule-1',
    classId: 'class-1',
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: '19:00:00',
    endTime: '21:00:00',
    room: 'A101',
    class: classEntity,
    ...overrides,
  } as Schedule;
}

describe('SchedulesService.getCalendar', () => {
  let service: SchedulesService;
  let membershipRepo: jest.Mocked<MembershipRepoMock>;
  let scheduleRepo: jest.Mocked<ScheduleRepoMock>;
  let teachersRepo: jest.Mocked<TeacherRepoMock>;
  let studentsRepo: jest.Mocked<StudentRepoMock>;
  let enrollmentsRepo: jest.Mocked<EnrollmentRepoMock>;
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Class),
          useValue: { find: jest.fn(), findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(Branch),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Teacher),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Student),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: { find: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    membershipRepo = module.get<jest.Mocked<MembershipRepoMock>>(
      getRepositoryToken(Membership),
    );
    scheduleRepo = module.get<jest.Mocked<ScheduleRepoMock>>(
      getRepositoryToken(Schedule),
    );
    teachersRepo = module.get<jest.Mocked<TeacherRepoMock>>(
      getRepositoryToken(Teacher),
    );
    studentsRepo = module.get<jest.Mocked<StudentRepoMock>>(
      getRepositoryToken(Student),
    );
    enrollmentsRepo = module.get<jest.Mocked<EnrollmentRepoMock>>(
      getRepositoryToken(Enrollment),
    );

    // Default: the current user is an owner/admin with an active membership.
    membershipRepo.findOne.mockResolvedValue({
      id: 'm-1',
      organizationId,
      role: { name: 'Organization Owner' },
    } as Membership);

    membershipRepo.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ organizationId }),
    } as unknown as QueryBuilder<Membership>);

    // Defaults for the other roles.
    teachersRepo.findOne.mockResolvedValue({ id: 'teacher-1' } as Teacher);
    studentsRepo.findOne.mockResolvedValue({ id: 'student-1' } as Student);
    enrollmentsRepo.find.mockResolvedValue([
      { classId: 'class-1' },
    ] as Enrollment[]);
  });

  it('returns no events when the user has no active membership', async () => {
    const { qb } = makeQueryBuilder();
    scheduleRepo.createQueryBuilder.mockReturnValue(qb);
    membershipRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an inverted date range', async () => {
    await expect(
      service.getCalendar(userId, {
        startDate: '2026-09-20',
        endDate: '2026-09-07',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('manager (owner/admin)', () => {
    it('expands a MONDAY schedule across every Monday in the range', async () => {
      const { qb } = makeQueryBuilder([makeSchedule()]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      const result: CalendarResponse = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-20',
      });

      expect(result.role).toBe('manager');
      expect(result.events).toHaveLength(2);
      expect(result.events.map((e) => e.date)).toEqual([
        '2026-09-07',
        '2026-09-14',
      ]);
      expect(result.events[0]).toMatchObject({
        scheduleId: 'schedule-1',
        id: 'schedule-1-2026-09-07',
        startTime: '19:00',
        endTime: '21:00',
        room: 'A101',
        class: { id: 'class-1', name: 'Java Basic', code: 'JAVA01' },
        course: { id: 'course-1', name: 'Java' },
        teacher: { id: 'teacher-1', name: 'Nguyen Van A' },
        branch: { id: 'branch-1', name: 'Ha Noi' },
      });
    });

    it('scopes the query to the current organization and applies a teacherId filter', async () => {
      const { qb, whereArgs, andWhereCalls } = makeQueryBuilder([
        makeSchedule(),
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        teacherId: 'teacher-other',
      });

      expect(whereArgs()).toMatchObject({ organizationId: 'org-1' });
      expect(andWhereCalls()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ teacherId: 'teacher-other' }),
        ]),
      );
    });

    it('applies branch, class and course filters', async () => {
      const { qb, andWhereCalls } = makeQueryBuilder([makeSchedule()]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        branchId: 'branch-1',
        classId: 'class-1',
        courseId: 'course-1',
      });

      const params = andWhereCalls();
      expect(params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ branchId: 'branch-1' }),
          expect.objectContaining({ classId: 'class-1' }),
          expect.objectContaining({ courseId: 'course-1' }),
        ]),
      );
    });
  });

  describe('teacher', () => {
    it('only shows schedules for the authenticated teacher, ignoring a client teacherId', async () => {
      const { qb, whereArgs, andWhereCalls } = makeQueryBuilder([
        makeSchedule(),
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);
      membershipRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Teacher' },
      });

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
        teacherId: 'teacher-someone-else',
      });

      expect(result.role).toBe('teacher');
      expect(whereArgs()).toMatchObject({ organizationId: 'org-1' });
      expect(andWhereCalls()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ teacherId: 'teacher-1' }),
        ]),
      );
      expect(andWhereCalls()).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ teacherId: 'teacher-someone-else' }),
        ]),
      );
      expect(result.events).toHaveLength(1);
    });

    it('returns an empty calendar when the user has no teacher record', async () => {
      const { qb } = makeQueryBuilder();
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);
      membershipRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Teacher' },
      });
      teachersRepo.findOne.mockResolvedValue(null);

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      });

      expect(result.role).toBe('teacher');
      expect(result.events).toEqual([]);
    });
  });

  describe('student', () => {
    it('only shows schedules for classes with an ACTIVE enrollment', async () => {
      const { qb, whereArgs, andWhereCalls } = makeQueryBuilder([
        makeSchedule(),
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);
      membershipRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Student' },
      });

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      });

      expect(result.role).toBe('student');
      expect(whereArgs()).toMatchObject({ organizationId: 'org-1' });
      expect(andWhereCalls()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ classIds: ['class-1'] }),
        ]),
      );
      expect(result.events).toHaveLength(1);
    });

    it('returns an empty calendar for a student with no active enrollments', async () => {
      membershipRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Student' },
      });
      enrollmentsRepo.find.mockResolvedValue([]);

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      });

      expect(result.events).toEqual([]);
    });
  });

  describe('recurrence expansion', () => {
    it('clips occurrences to the class start/end window', async () => {
      const schedule = makeSchedule({
        class: makeClassEntity({
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-09-10T00:00:00.000Z'),
        }),
      });
      const { qb } = makeQueryBuilder([schedule]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });

      // Mondays in the window: Sep 7 (Sep 14 is past the class end date).
      expect(result.events.map((e) => e.date)).toEqual(['2026-09-07']);
    });

    it('ignores schedules whose day never matches inside the range', async () => {
      const { qb } = makeQueryBuilder([
        makeSchedule({ dayOfWeek: DayOfWeek.FRIDAY }),
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-07',
      });

      expect(result.events).toEqual([]);
    });

    it('excludes classes that are cancelled or inactive', async () => {
      const { qb, whereArgs, andWhereCalls } = makeQueryBuilder([
        makeSchedule(),
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getCalendar(userId, {
        startDate: '2026-09-07',
        endDate: '2026-09-13',
      });

      expect(whereArgs()).toMatchObject({ organizationId: 'org-1' });
      expect(andWhereCalls()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ classStatus: ClassStatus.ACTIVE }),
          expect.objectContaining({
            cancelledStatus: ClassLifecycleStatus.CANCELLED,
          }),
        ]),
      );
    });
  });
});
