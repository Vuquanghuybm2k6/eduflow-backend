import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DashboardService } from './dashboard.service';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Class } from '../classes/entities/class.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';

type QbMethod =
  | 'innerJoin'
  | 'innerJoinAndSelect'
  | 'where'
  | 'andWhere'
  | 'select'
  | 'addSelect'
  | 'setParameters'
  | 'orderBy'
  | 'addOrderBy'
  | 'limit'
  | 'getOne'
  | 'getRawOne'
  | 'getCount'
  | 'getMany'
  | 'getRawMany';

function makeQb(terminalMethod: QbMethod, terminalResult: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    innerJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameters: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    limit: jest.fn(),
    getOne: jest.fn(),
    getRawOne: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
  };
  Object.values(qb).forEach((fn) => {
    fn.mockReturnValue(qb);
  });
  qb[terminalMethod].mockResolvedValue(terminalResult);
  return qb;
}

describe('DashboardService', () => {
  let service: DashboardService;

  let studentsRepo: Record<string, jest.Mock>;
  let teachersRepo: Record<string, jest.Mock>;
  let classesRepo: Record<string, jest.Mock>;
  let attendancesRepo: Record<string, jest.Mock>;
  let membershipsRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    studentsRepo = { createQueryBuilder: jest.fn() };
    teachersRepo = { createQueryBuilder: jest.fn() };
    classesRepo = { createQueryBuilder: jest.fn() };
    attendancesRepo = { createQueryBuilder: jest.fn() };
    membershipsRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Student), useValue: studentsRepo },
        { provide: getRepositoryToken(Teacher), useValue: teachersRepo },
        { provide: getRepositoryToken(Class), useValue: classesRepo },
        { provide: getRepositoryToken(Attendance), useValue: attendancesRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Enrollment), useValue: {} },
        { provide: getRepositoryToken(ClassSession), useValue: {} },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  function mockMembership() {
    membershipsRepo.createQueryBuilder.mockReturnValue(
      makeQb('getOne', { organizationId: 'org-1' }),
    );
  }

  function mockData(
    opts: {
      students?: { total: string; active: string };
      teachers?: { total: string; active: string };
      classes?: { total: string; active: string };
      lifecycle?: { upcoming: string; ongoing: string; completed: string };
      attendance?: {
        total: string;
        present: string;
        late: string;
        absent: string;
        excused: string;
      };
    } = {},
  ) {
    studentsRepo.createQueryBuilder.mockReturnValue(
      makeQb('getRawOne', opts.students ?? { total: '0', active: '0' }),
    );
    teachersRepo.createQueryBuilder.mockReturnValue(
      makeQb('getRawOne', opts.teachers ?? { total: '0', active: '0' }),
    );
    classesRepo.createQueryBuilder
      .mockReturnValueOnce(
        makeQb('getRawOne', opts.classes ?? { total: '0', active: '0' }),
      )
      .mockReturnValueOnce(
        makeQb(
          'getRawOne',
          opts.lifecycle ?? { upcoming: '0', ongoing: '0', completed: '0' },
        ),
      );
    attendancesRepo.createQueryBuilder.mockReturnValue(
      makeQb(
        'getRawOne',
        opts.attendance ?? {
          total: '0',
          present: '0',
          late: '0',
          absent: '0',
          excused: '0',
        },
      ),
    );
  }

  it('aggregates normal data across the organization', async () => {
    mockMembership();
    mockData({
      students: { total: '100', active: '92' },
      teachers: { total: '12', active: '10' },
      classes: { total: '20', active: '18' },
      lifecycle: { upcoming: '3', ongoing: '10', completed: '5' },
      attendance: {
        total: '1000',
        present: '820',
        late: '50',
        absent: '90',
        excused: '40',
      },
    });

    const result = await service.getStatistics('user-1');

    expect(result.students).toEqual({ total: 100, active: 92 });
    expect(result.teachers).toEqual({ total: 12, active: 10 });
    expect(result.classes).toEqual({
      total: 20,
      active: 18,
      upcoming: 3,
      ongoing: 10,
      completed: 5,
    });
    expect(result.attendance).toEqual({
      total: 1000,
      present: 820,
      late: 50,
      absent: 90,
      excused: 40,
      attendanceRate: ((820 + 50) / 1000) * 100,
    });
  });

  it('uses a global weighted rate instead of averaging class rates', async () => {
    mockMembership();
    mockData({
      students: { total: '10', active: '10' },
      teachers: { total: '2', active: '2' },
      classes: { total: '2', active: '2' },
      lifecycle: { upcoming: '0', ongoing: '2', completed: '0' },
      // 75% of all records attended -> rate must be 75, not (100+50)/2
      attendance: {
        total: '200',
        present: '150',
        late: '0',
        absent: '50',
        excused: '0',
      },
    });

    const result = await service.getStatistics('user-1');

    expect(result.attendance.attendanceRate).toBe(75);
  });

  it('returns null rate and zeroed counters when an organization has no attendance', async () => {
    mockMembership();
    mockData({
      students: { total: '10', active: '8' },
      teachers: { total: '3', active: '3' },
      classes: { total: '5', active: '4' },
      lifecycle: { upcoming: '2', ongoing: '4', completed: '1' },
      attendance: {
        total: '0',
        present: '0',
        late: '0',
        absent: '0',
        excused: '0',
      },
    });

    const result = await service.getStatistics('user-1');

    expect(result.attendance.total).toBe(0);
    expect(result.attendance.attendanceRate).toBeNull();
    expect(result.students.total).toBe(10);
  });

  it('does not crash when the organization has no students/teachers/classes', async () => {
    mockMembership();
    mockData();

    const result = await service.getStatistics('user-1');

    expect(result.students).toEqual({ total: 0, active: 0 });
    expect(result.teachers).toEqual({ total: 0, active: 0 });
    expect(result.classes).toEqual({
      total: 0,
      active: 0,
      upcoming: 0,
      ongoing: 0,
      completed: 0,
    });
    expect(result.attendance.attendanceRate).toBeNull();
  });

  it('forbids access when the membership cannot be resolved', async () => {
    membershipsRepo.createQueryBuilder.mockReturnValue(makeQb('getOne', null));

    await expect(service.getStatistics('user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rounds attendance rate to 2 decimals', async () => {
    mockMembership();
    mockData({
      students: { total: '1', active: '1' },
      teachers: { total: '1', active: '1' },
      classes: { total: '1', active: '1' },
      lifecycle: { upcoming: '0', ongoing: '1', completed: '0' },
      attendance: {
        total: '8',
        present: '7',
        late: '0',
        absent: '1',
        excused: '0',
      },
    });

    const result = await service.getStatistics('user-1');

    expect(result.attendance.attendanceRate).toBe(87.5);
  });
});
