import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from './entities/class.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Teacher, TeacherStatus } from '../teachers/entities/teacher.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity';
import { DayOfWeek, Schedule } from '../schedules/entities/schedule.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

export interface OrgContextOptions {
  organizationId?: string;
}

export interface FindClassesFilters {
  status?: ClassStatus;
  lifecycleStatus?: ClassLifecycleStatus;
  branchId?: string;
  courseId?: string;
  teacherId?: string;
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Thứ hai',
  TUESDAY: 'Thứ ba',
  WEDNESDAY: 'Thứ tư',
  THURSDAY: 'Thứ năm',
  FRIDAY: 'Thứ sáu',
  SATURDAY: 'Thứ bảy',
  SUNDAY: 'Chủ nhật',
};

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
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

  private async assertIsAdminOrOwner(userId: string, organizationId: string) {
    const membership = await this.membershipsRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { role: true },
    });

    if (!membership || !membership.role) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    const roleName = membership.role.name.toLowerCase();
    const isManager = roleName.includes('owner') || roleName.includes('admin');

    if (!isManager) {
      throw new ForbiddenException(
        'Only an owner or admin can perform this action',
      );
    }
  }

  /**
   * Derives the current lifecycle status from the clock, but never overrides a
   * manual CANCELLED state. The stored `lifecycleStatus` column is left
   * untouched; only the returned object reflects the computed value.
   */
  private computeLifecycleStatus(classEntity: Class): ClassLifecycleStatus {
    if (classEntity.lifecycleStatus === ClassLifecycleStatus.CANCELLED) {
      return ClassLifecycleStatus.CANCELLED;
    }

    const now = new Date();
    const start = new Date(classEntity.startDate);
    const end = new Date(classEntity.endDate);

    if (now < start) {
      return ClassLifecycleStatus.UPCOMING;
    }

    if (now <= end) {
      return ClassLifecycleStatus.ONGOING;
    }

    return ClassLifecycleStatus.COMPLETED;
  }

  private applyComputedLifecycleStatus(
    classEntity: Class,
  ): Class & { lifecycleStatus: ClassLifecycleStatus } {
    classEntity.lifecycleStatus = this.computeLifecycleStatus(classEntity);
    return classEntity;
  }

  private validateDates(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    if (start >= end) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }
  }

  private async assertCodeAvailable(
    organizationId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.classesRepository.findOneBy({
      organizationId,
      code,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mã lớp này đã tồn tại');
    }
  }

  /**
   * Multi-tenant guard: the referenced Branch/Course/Teacher must all belong
   * to the same organization as the current user.
   */
  private async assertReferencesInOrganization(
    organizationId: string,
    branchId: string,
    courseId: string,
    teacherId?: string,
  ): Promise<void> {
    const branch = await this.branchesRepository.findOne({
      where: { id: branchId },
      select: ['organizationId', 'status'],
    });
    if (!branch || branch.organizationId !== organizationId) {
      throw new ForbiddenException('Chi nhánh không thuộc tổ chức hiện tại');
    }
    if (branch.status !== BranchStatus.ACTIVE) {
      throw new ConflictException('Chi nhánh hiện đang ngừng hoạt động');
    }

    const course = await this.coursesRepository.findOne({
      where: { id: courseId },
      select: ['organizationId', 'status'],
    });
    if (!course || course.organizationId !== organizationId) {
      throw new ForbiddenException('Khóa học không thuộc tổ chức hiện tại');
    }
    if (course.status !== CourseStatus.ACTIVE) {
      throw new ConflictException('Khóa học hiện đang ngừng hoạt động');
    }

    if (teacherId) {
      const teacher = await this.teachersRepository.findOneBy({
        id: teacherId,
      });

      if (!teacher) {
        throw new NotFoundException('Giáo viên không tồn tại');
      }

      if (teacher.organizationId !== organizationId) {
        throw new ForbiddenException('Giáo viên không thuộc tổ chức hiện tại');
      }

      if (teacher.status !== TeacherStatus.ACTIVE) {
        throw new ForbiddenException('Giáo viên hiện không hoạt động');
      }
    }
  }

  private isOverlapping(
    newStart: string,
    newEnd: string,
    existingStart: string,
    existingEnd: string,
  ): boolean {
    return newStart < existingEnd && newEnd > existingStart;
  }

  private async assertCapacityNotBelowEnrollments(
    classId: string,
    newCapacity: number,
  ): Promise<void> {
    const activeCount = await this.enrollmentsRepository.countBy({
      classId,
      status: EnrollmentStatus.ACTIVE,
    });

    if (activeCount > newCapacity) {
      throw new BadRequestException(
        `Không thể giảm sức chứa xuống dưới ${activeCount} học viên đang theo học`,
      );
    }
  }

  /**
   * When a class teacher is changed, every schedule of THIS class must not
   * overlap the new teacher's schedules in other (non-cancelled) classes.
   */
  private async assertTeacherScheduleCompatible(
    organizationId: string,
    classId: string,
    teacherId: string | null | undefined,
  ): Promise<void> {
    if (!teacherId) {
      return;
    }

    const classSchedules = await this.schedulesRepository.find({
      where: { classId },
    });

    if (classSchedules.length === 0) {
      return;
    }

    const teacherSchedules = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.class', 'class')
      .where('class.organizationId = :organizationId', { organizationId })
      .andWhere('class.teacherId = :teacherId', { teacherId })
      .andWhere('class.id != :classId', { classId })
      .andWhere('class.lifecycleStatus != :cancelledStatus', {
        cancelledStatus: ClassLifecycleStatus.CANCELLED,
      })
      .getMany();

    for (const thisSched of classSchedules) {
      for (const sched of teacherSchedules) {
        if (
          sched.dayOfWeek === thisSched.dayOfWeek &&
          this.isOverlapping(
            thisSched.startTime,
            thisSched.endTime,
            sched.startTime,
            sched.endTime,
          )
        ) {
          const className = sched.class?.name ?? 'lớp khác';
          throw new ConflictException(
            `Giáo viên này đã có lịch dạy lớp "${className}" vào ${DAY_LABELS[thisSched.dayOfWeek]} ${sched.startTime} - ${sched.endTime}, trùng với lịch của lớp này`,
          );
        }
      }
    }
  }

  async create(
    userId: string,
    createClassDto: CreateClassDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    this.validateDates(createClassDto.startDate, createClassDto.endDate);
    await this.assertCodeAvailable(organizationId, createClassDto.code);
    await this.assertReferencesInOrganization(
      organizationId,
      createClassDto.branchId,
      createClassDto.courseId,
      createClassDto.teacherId,
    );

    const classEntity = this.classesRepository.create({
      ...createClassDto,
      startDate: createClassDto.startDate,
      endDate: createClassDto.endDate,
      teacherId: createClassDto.teacherId ?? null,
      lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      organizationId,
    });

    const saved = await this.classesRepository.save(classEntity);
    return this.applyComputedLifecycleStatus(saved);
  }

  async findAll(
    userId: string,
    options: OrgContextOptions = {},
    filters: FindClassesFilters = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classes = await this.classesRepository.find({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      },
      order: { createdAt: 'DESC' },
    });

    const withComputedLifecycle = classes.map((c) =>
      this.applyComputedLifecycleStatus(c),
    );

    return filters.lifecycleStatus
      ? withComputedLifecycle.filter(
          (c) => c.lifecycleStatus === filters.lifecycleStatus,
        )
      : withComputedLifecycle;
  }

  async findOne(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.classesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    return this.applyComputedLifecycleStatus(classEntity);
  }

  async update(
    userId: string,
    id: string,
    updateClassDto: UpdateClassDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.classesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const startDate = updateClassDto.startDate ?? classEntity.startDate;
    const endDate = updateClassDto.endDate ?? classEntity.endDate;
    this.validateDates(
      new Date(startDate).toISOString().slice(0, 10),
      new Date(endDate).toISOString().slice(0, 10),
    );

    if (updateClassDto.code !== undefined) {
      await this.assertCodeAvailable(organizationId, updateClassDto.code, id);
    }

    const branchId = updateClassDto.branchId ?? classEntity.branchId;
    const courseId = updateClassDto.courseId ?? classEntity.courseId;
    const teacherId =
      updateClassDto.teacherId !== undefined
        ? updateClassDto.teacherId
        : (classEntity.teacherId ?? undefined);
    await this.assertReferencesInOrganization(
      organizationId,
      branchId,
      courseId,
      teacherId,
    );

    if (
      updateClassDto.capacity !== undefined &&
      updateClassDto.capacity < classEntity.capacity
    ) {
      await this.assertCapacityNotBelowEnrollments(id, updateClassDto.capacity);
    }

    const effectiveTeacherId = teacherId ?? null;
    if (effectiveTeacherId !== (classEntity.teacherId ?? null)) {
      await this.assertTeacherScheduleCompatible(
        organizationId,
        id,
        effectiveTeacherId,
      );
    }

    Object.assign(classEntity, updateClassDto);

    const saved = await this.classesRepository.save(classEntity);
    return this.applyComputedLifecycleStatus(saved);
  }

  /**
   * No physical delete: a class keeps its history (students / attendance /
   * grades). Deleting just deactivates the record (status = INACTIVE) and
   * marks the lifecycle as CANCELLED.
   */
  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(userId, organizationId);

    const classEntity = await this.classesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const activeEnrollments = await this.enrollmentsRepository.countBy({
      classId: id,
      status: EnrollmentStatus.ACTIVE,
    });

    if (activeEnrollments > 0) {
      throw new ConflictException(
        'Không thể hủy lớp khi vẫn còn học viên đang theo học. Vui lòng ghi nhận kết thúc hoặc hủy ghi danh trước',
      );
    }

    const scheduleCount = await this.schedulesRepository.countBy({
      classId: id,
    });

    if (scheduleCount > 0) {
      throw new ConflictException(
        'Không thể hủy lớp khi vẫn còn lịch học. Vui lòng xóa lịch học trước',
      );
    }

    classEntity.status = ClassStatus.INACTIVE;
    classEntity.lifecycleStatus = ClassLifecycleStatus.CANCELLED;

    return this.classesRepository.save(classEntity);
  }

  async duplicate(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const original = await this.classesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!original) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const newCode = `${original.code}-COPY`;
    await this.assertCodeAvailable(organizationId, newCode);

    const duplicate = this.classesRepository.create({
      branchId: original.branchId,
      courseId: original.courseId,
      name: `${original.name} (Copy)`,
      code: newCode,
      teacherId: original.teacherId,
      startDate: original.startDate,
      endDate: original.endDate,
      capacity: original.capacity,
      lifecycleStatus: ClassLifecycleStatus.UPCOMING,
      organizationId,
    });

    const saved = await this.classesRepository.save(duplicate);
    return this.applyComputedLifecycleStatus(saved);
  }
}
