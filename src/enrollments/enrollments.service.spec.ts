import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import {
  Enrollment,
  EnrollmentStatus,
} from './entities/enrollment.entity';
import { Membership } from '../memberships/entities/membership.entity';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;

  const membershipQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const membershipsRepo = {
    createQueryBuilder: jest.fn(() => membershipQueryBuilder),
  };

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
    membershipQueryBuilder.getOne.mockResolvedValue({
      organizationId: 'org-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentsRepo },
        { provide: getRepositoryToken(Membership), useValue: membershipsRepo },
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
      } as Student);
      classesRepo.findOneBy.mockResolvedValue({
        id: 'c-1',
        organizationId: 'org-1',
        status: ClassStatus.ACTIVE,
        lifecycleStatus: ClassLifecycleStatus.UPCOMING,
        endDate: '2030-01-01',
        capacity: 10,
      } as Class);
      enrollmentsRepo.findOneBy.mockResolvedValue(null);
    });

    it('throws ConflictException when the student is already enrolled in the class', async () => {
      enrollmentsRepo.findOneBy.mockResolvedValue({ id: 'e-1' } as Enrollment);

      await expect(
        service.create('user-1', { studentId: 's-1', classId: 'c-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the class is at capacity', async () => {
      enrollmentsRepo.countBy.mockResolvedValue(10);

      await expect(
        service.create('user-1', { studentId: 's-1', classId: 'c-1' }),
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

      const result = await service.create('user-1', {
        studentId: 's-1',
        classId: 'c-1',
      });

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
      } as Enrollment);

      await expect(
        service.updateStatus('user-1', 'e-1', {
          status: EnrollmentStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a transition from CANCELLED to ACTIVE', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      } as Enrollment);

      await expect(
        service.updateStatus('user-1', 'e-1', {
          status: EnrollmentStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('allows transitioning an ACTIVE enrollment to CANCELLED', async () => {
      enrollmentQueryBuilder.getOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.ACTIVE,
      } as Enrollment);
      enrollmentsRepo.save.mockImplementation((e) => ({ ...e }));
      enrollmentsRepo.findOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      } as Enrollment);

      const result = await service.updateStatus('user-1', 'e-1', {
        status: EnrollmentStatus.CANCELLED,
      });

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
      } as Enrollment);
      enrollmentsRepo.save.mockImplementation((e) => ({ ...e }));
      enrollmentsRepo.findOne.mockResolvedValue({
        id: 'e-1',
        status: EnrollmentStatus.CANCELLED,
      } as Enrollment);

      const result = await service.remove('user-1', 'e-1');

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
      } as Enrollment);

      await expect(service.remove('user-1', 'e-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });
  });
});