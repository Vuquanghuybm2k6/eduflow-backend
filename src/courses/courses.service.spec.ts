import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };
  let membershipsRepository: {
    createQueryBuilder: jest.Mock;
  };
  let createQueryBuilder: {
    innerJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    limit: jest.Mock;
    getOne: jest.Mock;
  };

  const userId = 'user-1';
  const organizationId = 'org-1';
  const activeMembership = {
    userId,
    organizationId,
    status: MembershipStatus.ACTIVE,
  };

  beforeEach(async () => {
    createQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activeMembership),
    };

    membershipsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder),
    };

    coursesRepository = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn((entity: unknown) => entity),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getRepositoryToken(Course),
          useValue: coursesRepository,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipsRepository,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a course scoped to a resolved organization', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await service.create(userId, {
        name: 'Mathematics',
        code: 'MATH-101',
      });

      expect(coursesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Mathematics',
          code: 'MATH-101',
          organizationId,
          description: null,
          duration: null,
        }),
      );
    });

    it('throws ConflictException when the code is already used', async () => {
      coursesRepository.findOneBy.mockResolvedValue({ id: 'other-id' });

      await expect(
        service.create(userId, { name: 'Math', code: 'MATH-101' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when the user has no membership', async () => {
      createQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.create(userId, { name: 'Math', code: 'MATH-101' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('queries courses for the resolved organization', async () => {
      coursesRepository.find.mockResolvedValue([{ id: 'course-1' }]);

      const result = await service.findAll(userId);

      expect(coursesRepository.find).toHaveBeenCalledWith({
        where: { organizationId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the course does not exist', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the course when found', async () => {
      coursesRepository.findOneBy.mockResolvedValue({ id: 'course-1' });

      const result = await service.findOne(userId, 'course-1');

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        id: 'course-1',
        organizationId,
      });
      expect(result).toEqual({ id: 'course-1' });
    });
  });

  describe('update', () => {
    it('updates an existing course', async () => {
      coursesRepository.findOneBy.mockResolvedValue({
        id: 'course-1',
        name: 'Old',
      });

      await service.update(userId, 'course-1', { name: 'New' });

      expect(coursesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New' }),
      );
    });

    it('throws NotFoundException when the course does not exist', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(userId, 'missing', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes an existing course', async () => {
      coursesRepository.findOneBy.mockResolvedValue({ id: 'course-1' });

      const result = await service.remove(userId, 'course-1');

      expect(coursesRepository.remove).toHaveBeenCalledWith({
        id: 'course-1',
      });
      expect(result).toEqual({ id: 'course-1' });
    });

    it('throws NotFoundException when the course does not exist', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('enums', () => {
    it('exposes CourseStatus values', () => {
      expect(CourseStatus.INACTIVE).toBe('inactive');
    });
  });
});
