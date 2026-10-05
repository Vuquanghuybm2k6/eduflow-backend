import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseStatus } from './entities/course.entity';

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };

  const organizationId = 'org-1';

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a course scoped to the JWT organization context', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await service.create(
        {
          name: 'Mathematics',
          code: 'MATH-101',
        },
        organizationId,
      );

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
        service.create({ name: 'Math', code: 'MATH-101' }, organizationId),
      ).rejects.toThrow(ConflictException);
    });

    it('only looks up duplicate codes within the organization', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await service.create({ name: 'Math', code: 'MATH-101' }, organizationId);

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        organizationId,
        code: 'MATH-101',
      });
    });
  });

  describe('findAll', () => {
    it('queries courses for the JWT organization context', async () => {
      coursesRepository.find.mockResolvedValue([{ id: 'course-1' }]);

      const result = await service.findAll(organizationId);

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

      await expect(service.findOne('missing', organizationId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the course when found', async () => {
      coursesRepository.findOneBy.mockResolvedValue({ id: 'course-1' });

      const result = await service.findOne('course-1', organizationId);

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        id: 'course-1',
        organizationId,
      });
      expect(result).toEqual({ id: 'course-1' });
    });

    it('does not return a course belonging to another organization', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('foreign-course', 'org-2')).rejects.toThrow(
        NotFoundException,
      );

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        id: 'foreign-course',
        organizationId: 'org-2',
      });
    });
  });

  describe('update', () => {
    it('updates an existing course', async () => {
      coursesRepository.findOneBy.mockResolvedValue({
        id: 'course-1',
        name: 'Old',
      });

      await service.update('course-1', { name: 'New' }, organizationId);

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        id: 'course-1',
        organizationId,
      });
      expect(coursesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New' }),
      );
    });

    it('throws NotFoundException when the course does not exist', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'New' }, organizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes an existing course', async () => {
      coursesRepository.findOneBy.mockResolvedValue({ id: 'course-1' });

      const result = await service.remove('course-1', organizationId);

      expect(coursesRepository.findOneBy).toHaveBeenCalledWith({
        id: 'course-1',
        organizationId,
      });
      expect(coursesRepository.remove).toHaveBeenCalledWith({
        id: 'course-1',
      });
      expect(result).toEqual({ id: 'course-1' });
    });

    it('throws NotFoundException when the course does not exist', async () => {
      coursesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('missing', organizationId)).rejects.toThrow(
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
