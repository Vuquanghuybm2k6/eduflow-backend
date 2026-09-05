import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Enrollment, EnrollmentStatus } from './entities/enrollment.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { Student, StudentStatus } from '../students/entities/student.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';

const ALLOWED_ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  [EnrollmentStatus.ACTIVE]: [
    EnrollmentStatus.ACTIVE,
    EnrollmentStatus.COMPLETED,
    EnrollmentStatus.CANCELLED,
  ],
  [EnrollmentStatus.COMPLETED]: [],
  [EnrollmentStatus.CANCELLED]: [],
};

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
  ) {}

  private async resolveOrganizationId(
    userId: string,
    requestedOrganizationId?: string,
  ): Promise<string> {
    const qb = this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.organization', 'organization')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.ACTIVE,
      });

    if (requestedOrganizationId) {
      qb.andWhere('membership.organizationId = :organizationId', {
        organizationId: requestedOrganizationId,
      });
    }

    qb.orderBy('membership.joinedAt', 'ASC')
      .addOrderBy('membership.createdAt', 'ASC')
      .limit(1);

    const membership = await qb.getOne();

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    return membership.organizationId;
  }

  private async assertStudentInOrganization(
    organizationId: string,
    studentId: string,
  ): Promise<Student> {
    const student = await this.studentsRepository.findOneBy({
      id: studentId,
      organizationId,
    });

    if (!student) {
      throw new NotFoundException('Học sinh không tồn tại');
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('Học sinh hiện không hoạt động');
    }

    return student;
  }

  private async assertClassInOrganization(
    organizationId: string,
    classId: string,
  ): Promise<Class> {
    const classEntity = await this.classesRepository.findOneBy({
      id: classId,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    if (classEntity.status !== ClassStatus.ACTIVE) {
      throw new BadRequestException('Lớp học hiện không hoạt động');
    }

    if (classEntity.lifecycleStatus === ClassLifecycleStatus.CANCELLED) {
      throw new BadRequestException('Không thể ghi danh vào lớp đã hủy');
    }

    if (new Date(classEntity.endDate) < new Date()) {
      throw new BadRequestException('Không thể ghi danh vào lớp đã kết thúc');
    }

    return classEntity;
  }

  async create(
    userId: string,
    createEnrollmentDto: CreateEnrollmentDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    await this.assertStudentInOrganization(
      organizationId,
      createEnrollmentDto.studentId,
    );
    const classEntity = await this.assertClassInOrganization(
      organizationId,
      createEnrollmentDto.classId,
    );

    const existing = await this.enrollmentsRepository.findOneBy({
      studentId: createEnrollmentDto.studentId,
      classId: createEnrollmentDto.classId,
    });

    if (existing) {
      throw new ConflictException('Học sinh đã ghi danh vào lớp này');
    }

    const activeCount = await this.enrollmentsRepository.countBy({
      classId: createEnrollmentDto.classId,
      status: EnrollmentStatus.ACTIVE,
    });

    if (activeCount >= classEntity.capacity) {
      throw new BadRequestException('Lớp đã hết chỗ');
    }

    const enrollment = this.enrollmentsRepository.create({
      studentId: createEnrollmentDto.studentId,
      classId: createEnrollmentDto.classId,
      status: EnrollmentStatus.ACTIVE,
      enrolledAt: new Date(),
    });

    const saved = await this.enrollmentsRepository.save(enrollment);

    return this.enrollmentsRepository.findOne({
      where: { id: saved.id },
      relations: ['student', 'class'],
    });
  }

  async findAll(userId: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('enrollment.class', 'class')
      .where('student.organizationId = :organizationId', { organizationId })
      .orderBy('enrollment.createdAt', 'DESC')
      .getMany();
  }

  async findOne(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const enrollment = await this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('enrollment.class', 'class')
      .where('enrollment.id = :id', { id })
      .andWhere('student.organizationId = :organizationId', {
        organizationId,
      })
      .getOne();

    if (!enrollment) {
      throw new NotFoundException('Bản ghi ghi danh không tồn tại');
    }

    return enrollment;
  }

  async findByStudent(
    userId: string,
    studentId: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('enrollment.class', 'class')
      .where('enrollment.studentId = :studentId', { studentId })
      .andWhere('student.organizationId = :organizationId', {
        organizationId,
      })
      .orderBy('enrollment.createdAt', 'DESC')
      .getMany();
  }

  async findByClass(
    userId: string,
    classId: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.student', 'student')
      .leftJoinAndSelect('student.user', 'studentUser')
      .leftJoinAndSelect('enrollment.class', 'class')
      .where('enrollment.classId = :classId', { classId })
      .andWhere('student.organizationId = :organizationId', {
        organizationId,
      })
      .orderBy('enrollment.createdAt', 'DESC')
      .getMany();
  }

  async updateStatus(
    userId: string,
    id: string,
    updateEnrollmentStatusDto: UpdateEnrollmentStatusDto,
    options: OrgContextOptions = {},
  ) {
    const enrollment = await this.findOne(userId, id, options);

    const allowedTransitions =
      ALLOWED_ENROLLMENT_TRANSITIONS[enrollment.status] ?? [];

    if (!allowedTransitions.includes(updateEnrollmentStatusDto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái ghi danh từ ${enrollment.status} sang ${updateEnrollmentStatusDto.status}`,
      );
    }

    enrollment.status = updateEnrollmentStatusDto.status;

    const saved = await this.enrollmentsRepository.save(enrollment);

    return this.enrollmentsRepository.findOne({
      where: { id: saved.id },
      relations: ['student', 'class'],
    });
  }

  /**
   * No physical delete: an enrollment keeps its history. "Deleting" cancels
   * the enrollment (status = CANCELLED). A COMPLETED enrollment cannot be
   * cancelled because that would rewrite history.
   */
  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const enrollment = await this.findOne(userId, id, options);

    if (enrollment.status === EnrollmentStatus.COMPLETED) {
      throw new ConflictException(
        'Không thể hủy ghi danh đã hoàn thành. Vui lòng giữ nguyên để bảo toàn lịch sử',
      );
    }

    if (enrollment.status !== EnrollmentStatus.CANCELLED) {
      enrollment.status = EnrollmentStatus.CANCELLED;
      await this.enrollmentsRepository.save(enrollment);
    }

    return this.enrollmentsRepository.findOne({
      where: { id: enrollment.id },
      relations: ['student', 'class'],
    });
  }
}
