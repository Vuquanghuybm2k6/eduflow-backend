import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { DayOfWeek, Schedule } from './entities/schedule.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { Membership } from '../memberships/entities/membership.entity';

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
          provide: getRepositoryToken(Membership),
          useValue: {
            createQueryBuilder: jest.fn(),
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
    membershipRepo = module.get(getRepositoryToken(Membership));

    // Default: resolveOrganizationId succeeds via the membership repo.
    membershipRepo.createQueryBuilder.mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ organizationId }),
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

    it('rejects when endTime is not greater than startTime', async () => {
      await expect(
        service.create(userId, classId, { ...baseDto, endTime: '18:00' }),
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
        service.create(userId, classId, baseDto),
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
        service.create(userId, classId, {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '19:00',
          endTime: '21:00',
        }),
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
        service.create(userId, classId, {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '20:00',
          endTime: '22:00',
        }),
      ).resolves.toBeDefined();
    });

    it('rejects when the class does not exist', async () => {
      classRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(userId, classId, baseDto),
      ).rejects.toBeInstanceOf(NotFoundException);
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
        service.create(userId, classId, {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        }),
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
      const result = await service.createBulk(userId, classId, sessions());
      expect(result).toHaveLength(2);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('rejects when any session has an invalid time range', async () => {
      await expect(
        service.createBulk(userId, classId, {
          sessions: [
            {
              dayOfWeek: DayOfWeek.MONDAY,
              startTime: '18:00',
              endTime: '18:00',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when two new sessions overlap each other on the same day', async () => {
      await expect(
        service.createBulk(userId, classId, {
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
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows the same time on different days', async () => {
      const result = await service.createBulk(userId, classId, sessions());
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
        service.createBulk(userId, classId, sessions()),
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
        service.createBulk(userId, classId, sessions()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when the class does not exist', async () => {
      classRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.createBulk(userId, classId, sessions()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
