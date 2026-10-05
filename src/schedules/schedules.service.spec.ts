import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { DayOfWeek, Schedule } from './entities/schedule.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Student } from '../students/entities/student.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';

const userId = 'user-1';
const organizationId = 'org-1';
const classId = 'class-1';
const teacherId = 'teacher-1';

function buildScheduleQueryBuilderMock() {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

describe('SchedulesService', () => {
  let service: SchedulesService;
  let scheduleRepo: jest.Mocked<Partial<Repository<Schedule>>>;
  let classRepo: jest.Mocked<Partial<Repository<Class>>>;
  let branchRepo: jest.Mocked<Partial<Repository<Branch>>>;
  let courseRepo: jest.Mocked<Partial<Repository<Course>>>;
  let membershipRepo: jest.Mocked<Partial<Repository<Membership>>>;
  const dataSource = {
    transaction: jest.fn((cb: (manager: any) => any) =>
      cb({ save: jest.fn((e) => e) }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            create: jest.fn((e) => e),
            save: jest.fn((e) => e),
            remove: jest.fn((e) => e),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Class),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Branch),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Course),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Teacher),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Student),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    scheduleRepo = module.get(getRepositoryToken(Schedule));
    classRepo = module.get(getRepositoryToken(Class));
    branchRepo = module.get(getRepositoryToken(Branch));
    courseRepo = module.get(getRepositoryToken(Course));
    membershipRepo = module.get(getRepositoryToken(Membership));

    // Default: branch and course are still active.
    branchRepo.findOneBy.mockResolvedValue({
      id: 'branch-1',
      status: BranchStatus.ACTIVE,
    });
    courseRepo.findOneBy.mockResolvedValue({
      id: 'course-1',
      status: CourseStatus.ACTIVE,
    });

    // Default: the current user is an owner/admin.
    membershipRepo.findOne.mockResolvedValue({
      id: 'm-1',
      organizationId,
      role: { name: 'Owner' },
    } as any);

    // Default: no teacher conflict (empty list of other-class schedules).
    scheduleRepo.createQueryBuilder.mockReturnValue(
      buildScheduleQueryBuilderMock() as any,
    );
  });

  describe('create', () => {
    const baseDto = {
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: '18:00' as string,
      endTime: '20:00' as string,
    };

    beforeEach(() => {
      classRepo.findOneBy.mockResolvedValue({
        id: classId,
        organizationId,
        teacherId,
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      });
      scheduleRepo.find.mockResolvedValue([]);
    });

    it.todo('books a schedule when there is no conflict');

    it('scopes the class lookup to the current organization', async () => {
      await service.create(classId, baseDto, organizationId);

      expect(classRepo.findOneBy).toHaveBeenCalledWith({
        id: classId,
        organizationId,
      });
    });

    it('rejects when endTime is not greater than startTime', async () => {
      await expect(
        service.create(
          classId,
          { ...baseDto, endTime: '18:00' },
          organizationId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the same slot already exists for the class', async () => {
      scheduleRepo.find.mockResolvedValue([
        {
          id: 'sched-existing',
          classId,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        } as Schedule,
      ]);

      await expect(
        service.create(classId, baseDto, organizationId),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the new slot overlaps an existing one', async () => {
      scheduleRepo.find.mockResolvedValue([
        {
          id: 'sched-existing',
          classId,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        } as Schedule,
      ]);

      await expect(
        service.create(
          classId,
          {
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '19:00',
            endTime: '21:00',
          },
          organizationId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows a back-to-back slot (boundary touch is allowed)', async () => {
      scheduleRepo.find.mockResolvedValue([
        {
          id: 'sched-existing',
          classId,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        } as Schedule,
      ]);

      await expect(
        service.create(
          classId,
          {
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '20:00',
            endTime: '22:00',
          },
          organizationId,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects when the class does not exist', async () => {
      classRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(classId, baseDto, organizationId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the class branch is not active', async () => {
      branchRepo.findOneBy.mockResolvedValue({
        id: 'branch-1',
        status: BranchStatus.INACTIVE,
      });

      await expect(
        service.create(classId, baseDto, organizationId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the class course is not active', async () => {
      courseRepo.findOneBy.mockResolvedValue({
        id: 'course-1',
        status: CourseStatus.INACTIVE,
      });

      await expect(
        service.create(classId, baseDto, organizationId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the teacher teaches an overlapping class', async () => {
      scheduleRepo.find.mockResolvedValue([]);
      const qb = buildScheduleQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          id: 'sched-other',
          classId: 'class-2',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '19:00',
          endTime: '21:00',
        } as Schedule,
      ]);

      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      await expect(
        service.create(
          classId,
          {
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '18:00',
            endTime: '20:00',
          },
          organizationId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createBulk', () => {
    const sessions = () => ({
      sessions: [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        },
        {
          dayOfWeek: DayOfWeek.WEDNESDAY,
          startTime: '18:00',
          endTime: '20:00',
        },
      ],
    });

    beforeEach(() => {
      classRepo.findOneBy.mockResolvedValue({
        id: classId,
        organizationId,
        teacherId,
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      });
      scheduleRepo.find.mockResolvedValue([]);
      dataSource.transaction.mockImplementation((cb: (manager: any) => any) =>
        cb({ save: jest.fn((e) => e) }),
      );
    });

    it('creates multiple sessions atomically when there is no conflict', async () => {
      const result = await service.createBulk(
        classId,
        sessions(),
        organizationId,
      );
      expect(result).toHaveLength(2);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('rejects when any session has an invalid time range', async () => {
      await expect(
        service.createBulk(
          classId,
          {
            sessions: [
              {
                dayOfWeek: DayOfWeek.MONDAY,
                startTime: '18:00',
                endTime: '18:00',
              },
            ],
          },
          organizationId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when two new sessions overlap each other on the same day', async () => {
      await expect(
        service.createBulk(
          classId,
          {
            sessions: [
              {
                dayOfWeek: DayOfWeek.MONDAY,
                startTime: '18:00',
                endTime: '20:00',
              },
              {
                dayOfWeek: DayOfWeek.MONDAY,
                startTime: '19:00',
                endTime: '21:00',
              },
            ],
          },
          organizationId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows the same time on different days', async () => {
      const result = await service.createBulk(
        classId,
        sessions(),
        organizationId,
      );
      expect(result).toHaveLength(2);
    });

    it('rejects when a session overlaps the class existing schedule', async () => {
      scheduleRepo.find.mockResolvedValue([
        {
          id: 'sched-existing',
          classId,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        } as Schedule,
      ]);

      await expect(
        service.createBulk(classId, sessions(), organizationId),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when a session overlaps the teacher other-class schedule', async () => {
      scheduleRepo.find.mockResolvedValue([]);
      const qb = buildScheduleQueryBuilderMock();
      qb.getMany.mockResolvedValue([
        {
          id: 'sched-other',
          classId: 'class-2',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '19:00',
          endTime: '21:00',
          class: {
            name: 'Math B',
            teacher: { user: { fullName: 'Huy Vũ Quang' } },
          },
        } as any,
      ]);
      scheduleRepo.createQueryBuilder.mockReturnValue(qb as any);

      await expect(
        service.createBulk(classId, sessions(), organizationId),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the class does not exist', async () => {
      classRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createBulk(classId, sessions(), organizationId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the class course is not active', async () => {
      courseRepo.findOneBy.mockResolvedValue({
        id: 'course-1',
        status: CourseStatus.INACTIVE,
      });

      await expect(
        service.createBulk(classId, sessions(), organizationId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when the user is not an owner or admin', async () => {
      membershipRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId,
        role: { name: 'Staff' },
      } as any);

      await expect(
        service.remove(userId, 'sched-1', organizationId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(scheduleRepo.remove).not.toHaveBeenCalled();
    });

    it('allows an owner/admin to delete the schedule', async () => {
      scheduleRepo.findOneBy.mockResolvedValue({
        id: 'sched-1',
        classId,
      });
      classRepo.findOneBy.mockResolvedValue({
        id: classId,
        organizationId,
        teacherId,
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      });
      scheduleRepo.remove.mockResolvedValue({
        id: 'sched-1',
        classId,
      });

      const result = await service.remove(userId, 'sched-1', organizationId);

      expect(scheduleRepo.remove).toHaveBeenCalled();
      expect(result.id).toBe('sched-1');
      expect(classRepo.findOneBy).toHaveBeenCalledWith({
        id: classId,
        organizationId,
      });
    });
  });
});
