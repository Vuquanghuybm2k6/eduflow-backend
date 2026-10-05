import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { Enrollment, EnrollmentStatus } from './entities/enrollment.entity';
import { Student, StudentStatus } from '../students/entities/student.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  const enrollmentQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  const studentsRepo = {
    findOneBy: jest.fn(),
  };
  const classesRepo = {
    findOneBy: jest.fn(),
  };
  const enrollmentsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => enrollmentQueryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentsRepo },
        { provide: getRepositoryToken(Student), useValue: studentsRepo },
        { provide: getRepositoryToken(Class), useValue: classesRepo },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    beforeEach(() => {
      studentsRepo.findOneBy.mockResolvedValue({
        id: 's-1',
        organizationId: 'org-1',
        status: StudentStatus.ACTIVE,
      });
      classesRepo.findOneBy.mockResolvedValue({
        id: 'c-1',
        organizationId: 'org-1',
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
        endDate: '2030-01-01',
        capacity: 10,
      });
      enrollmentsRepo.findOneBy.mockResolvedValue(null);
    });

    it('throws ConflictException when the student is already enrolled in the class', async () => {
      enrollmentsRepo.findOneBy.mockResolvedValue({ id: 'e-1' });

      await expect(
        service.create({ studentId: 's-1', classId: 'c-1' }, 'org-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the class is at capacity', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(10);

      await expect(
        service.create({ studentId: 's-1', classId: 'c-1' }, 'org-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('creates the enrollment with status ACTIVE when capacity is available', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(5);
      enrollmentsRepo.create.mockImplementation((e) => ({ ...e }));
      enrollmentsRepo.save.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.ACTIVE,
      });
      enrollmentsRepo.findOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.ACTIVE,
      });

      const result = await service.create(
        { studentId: 's-1', classId: 'c-1' },
        'org-1',
      );

      expect(enrollmentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollmentStatus.ACTIVE }),
      );
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
    });
  });

  describe('updateStatus', () => {
    it('throws BadRequestException for an invalid transition from COMPLETED to ACTIVE', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(
          'e-1',
          { status: EnrollmentStatus.ACTIVE },
          'org-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a transition from CANCELLED to ACTIVE', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      });

      await expect(
        service.updateStatus(
          'e-1',
          { status: EnrollmentStatus.ACTIVE },
          'org-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('allows transitioning an ACTIVE enrollment to CANCELLED', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.ACTIVE,
      });
      enrollmentsRepo.save.mockImplementation((e) => ({ ...e }));
      enrollmentsRepo.findOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      });

      const result = await service.updateStatus(
        'e-1',
        { status: EnrollmentStatus.CANCELLED },
        'org-1',
      );

      expect(enrollmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollmentStatus.CANCELLED }),
      );
      expect(result.status).toBe(EnrollmentStatus.CANCELLED);
    });
  });

  describe('remove', () => {
    it('soft-cancels the enrollment instead of hard-deleting it', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.ACTIVE,
      });
      enrollmentsRepo.save.mockImplementation((e) => ({ ...e }));
      enrollmentsRepo.findOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      });

      const result = await service.remove('e-1', 'org-1');

      expect(enrollmentsRepo.remove).not.toHaveBeenCalled();
      expect(enrollmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EnrollmentStatus.CANCELLED }),
      );
      expect(result.status).toBe(EnrollmentStatus.CANCELLED);
    });

    it('throws ConflictException when trying to cancel a COMPLETED enrollment', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.COMPLETED,
      });

      await expect(service.remove('e-1', 'org-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('organization isolation', () => {
    it('create looks up the student within the current organization', async () => {
      studentsRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({ studentId: 's-1', classId: 'c-1' }, 'org-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(studentsRepo.findOneBy).toHaveBeenCalledWith({
        id: 's-1',
        organizationId: 'org-1',
      });
    });

    it('create looks up the class within the current organization', async () => {
      studentsRepo.findOneBy.mockResolvedValue({
        id: 's-1',
        organizationId: 'org-1',
        status: StudentStatus.ACTIVE,
      });
      classesRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({ studentId: 's-1', classId: 'c-1' }, 'org-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(classesRepo.findOneBy).toHaveBeenCalledWith({
        id: 'c-1',
        organizationId: 'org-1',
      });
    });

    it('findAll only queries enrollments of the current organization', async () => {
      enrollmentQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll('org-1');

      expect(enrollmentQueryBuilder.where).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
    });

    it('findOne scopes the lookup to the current organization', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findOne('e-1', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(enrollmentQueryBuilder.andWhere).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
    });

    it('findByStudent scopes the lookup to the current organization', async () => {
      enrollmentQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByStudent('s-1', 'org-1');

      expect(enrollmentQueryBuilder.andWhere).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
    });

    it('findByClass scopes the lookup to the current organization', async () => {
      enrollmentQueryBuilder.getMany.mockResolvedValue([]);

      await service.findByClass('c-1', 'org-1');

      expect(enrollmentQueryBuilder.andWhere).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
    });

    it('remove loads the enrollment within the current organization', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.remove('e-1', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(enrollmentQueryBuilder.andWhere).toHaveBeenCalledWith(
        'student.organizationId = :organizationId',
        { organizationId: 'org-1' },
      );
    });
  });
});
