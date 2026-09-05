import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from './entities/class.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Teacher, TeacherStatus } from '../teachers/entities/teacher.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity';
import { DayOfWeek, Schedule } from '../schedules/entities/schedule.entity';

describe('ClassesService', () => {
  let service: ClassesService;

  const membershipQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
  };

  const classQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const scheduleQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const classesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((e) => e),
    save: jest.fn((e) => e),
    remove: jest.fn((e) => e),
    createQueryBuilder: jest.fn(() => classQueryBuilder),
  };

  const membershipsRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => membershipQueryBuilder),
  };

  const branchesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  const coursesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  const teachersRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  const enrollmentsRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn().mockResolvedValue(0),
  };

  const schedulesRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn(),
    countBy: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => scheduleQueryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: getRepositoryToken(Class), useValue: classesRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
        { provide: getRepositoryToken(Branch), useValue: branchesRepo },
        { provide: getRepositoryToken(Course), useValue: coursesRepo },
        { provide: getRepositoryToken(Teacher), useValue: teachersRepo },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: enrollmentsRepo,
        },
        { provide: getRepositoryToken(Schedule), useValue: schedulesRepo },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    const existingClass = {
      id: 'c-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      courseId: 'course-1',
      teacherId: 'teacher-1',
      name: 'Lớp Toán 10A',
      code: 'T10A',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      capacity: 30,
      status: ClassStatus.ACTIVE,
      lifecycleStatus: ClassLifecycleStatus.UPCOMING,
    } as Class;

    beforeEach(() => {
      classesRepo.findOneBy.mockResolvedValue(existingClass);
      branchesRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-1',
        status: BranchStatus.ACTIVE,
      });
      coursesRepo.findOne.mockResolvedValue({
        id: 'course-1',
        organizationId: 'org-1',
        status: CourseStatus.ACTIVE,
      });
      teachersRepo.findOneBy.mockResolvedValue({
        id: 'teacher-1',
        organizationId: 'org-1',
        status: TeacherStatus.ACTIVE,
      });
    });

    it('throws BadRequestException when reducing capacity below active enrollments', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(35);

      await expect(
        service.update('user-1', 'c-1', { capacity: 20 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('allows reducing capacity when active enrollments fit', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(10);

      const result = await service.update('user-1', 'c-1', { capacity: 20 });

      expect(classesRepo.save).toHaveBeenCalled();
      expect(result.capacity).toBe(20);
    });

    it('throws ConflictException when the new teacher has an overlapping schedule in another class', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(5);
      schedulesRepo.find.mockResolvedValue([
        {
          id: 's-1',
          classId: 'c-1',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '18:00',
          endTime: '20:00',
        } as Schedule,
      ]);
      scheduleQueryBuilder.getMany.mockResolvedValue([
        {
          id: 's-2',
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '19:00',
          endTime: '21:00',
          class: { name: 'Lớp Toán 10B' },
        } as Schedule,
      ]);

      await expect(
        service.update('user-1', 'c-1', { teacherId: 'teacher-2' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the course is INACTIVE', async () => {
      coursesRepo.findOne.mockResolvedValue({
        id: 'course-1',
        organizationId: 'org-1',
        status: CourseStatus.INACTIVE,
      });

      await expect(
        service.update('user-1', 'c-1', { name: 'Lớp Toán 10C' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('allows changing the teacher when schedules do not overlap', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(5);
      scheduleQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.update('user-1', 'c-1', {
        teacherId: 'teacher-2',
      });

      expect(classesRepo.save).toHaveBeenCalled();
      expect(result.teacherId).toBe('teacher-2');
    });
  });

  describe('remove', () => {
    const existingClass = {
      id: 'c-1',
      organizationId: 'org-1',
      status: ClassStatus.ACTIVE,
      lifecycleStatus: ClassLifecycleStatus.UPCOMING,
    } as Class;

    beforeEach(() => {
      classesRepo.findOneBy.mockResolvedValue(existingClass);
      membershipsRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId: 'org-1',
        role: { name: 'Owner' },
      });
    });

    it('throws ForbiddenException when the user is not an owner or admin', async () => {
      membershipsRepo.findOne.mockResolvedValue({
        id: 'm-1',
        organizationId: 'org-1',
        role: { name: 'Staff' },
      });

      await expect(service.remove('user-1', 'c-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the class still has active enrollments', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(3);

      await expect(service.remove('user-1', 'c-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the class still has schedules', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(0);
      schedulesRepo.countBy.mockResolvedValue(2);

      await expect(service.remove('user-1', 'c-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(classesRepo.save).not.toHaveBeenCalled();
    });

    it('deactivates the class when no active enrollments and no schedules remain', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(0);
      schedulesRepo.countBy.mockResolvedValue(0);

      const result = await service.remove('user-1', 'c-1');

      expect(classesRepo.save).toHaveBeenCalledWith({
        id: 'c-1',
        organizationId: 'org-1',
        status: ClassStatus.INACTIVE,
        lifecycleStatus: ClassLifecycleStatus.CANCELLED,
      });
      expect(result.status).toBe(ClassStatus.INACTIVE);
      expect(result.lifecycleStatus).toBe(ClassLifecycleStatus.CANCELLED);
    });
  });

  describe('capacity check uses ACTIVE enrollments only', () => {
    beforeEach(() => {
      classesRepo.findOneBy.mockResolvedValue({
        id: 'c-1',
        organizationId: 'org-1',
        branchId: 'branch-1',
        courseId: 'course-1',
        teacherId: 'teacher-1',
        name: 'Lớp Toán 10A',
        code: 'T10A',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        capacity: 30,
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      });
      branchesRepo.findOne.mockResolvedValue({
        id: 'branch-1',
        organizationId: 'org-1',
        status: BranchStatus.ACTIVE,
      });
      coursesRepo.findOne.mockResolvedValue({
        id: 'course-1',
        organizationId: 'org-1',
        status: CourseStatus.ACTIVE,
      });
      teachersRepo.findOneBy.mockResolvedValue({
        id: 'teacher-1',
        organizationId: 'org-1',
        status: TeacherStatus.ACTIVE,
      });
    });

    it('counts enrollments with status ACTIVE', async () => {
      enrollmentsRepo.countBy.mockImplementation((where) => {
        expect(where.status).toBe(EnrollmentStatus.ACTIVE);
        return Promise.resolve(40);
      });

      await expect(
        service.update('user-1', 'c-1', { capacity: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
