import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { DayOfWeek, Schedule } from './entities/schedule.entity';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateSessionsDto } from './dto/create-sessions.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

export interface OrgContextOptions {
  organizationId?: string;
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

interface ScheduleConflictDetails {
  type: 'class' | 'teacher' | 'internal';
  dayOfWeek?: DayOfWeek;
  dayLabel?: string;
  startTime?: string;
  endTime?: string;
  teacherName?: string;
  className?: string;
}

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    private readonly dataSource: DataSource,
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

  private async assertIsAdminOrOwner(
    userId: string,
    organizationId: string,
  ): Promise<void> {
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
   * Ensures the class exists, belongs to the current organization, and is not
   * cancelled/completed (only editable states allow scheduling).
   */
  private async assertClassEditable(
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
      throw new BadRequestException('Không thể tạo lịch học cho lớp đã bị hủy');
    }

    return classEntity;
  }

  /**
   * A class's branch and course must both still be active before a new
   * schedule can be created.
   */
  private async assertBranchAndCourseActive(classEntity: Class): Promise<void> {
    const [branch, course] = await Promise.all([
      this.branchesRepository.findOneBy({ id: classEntity.branchId }),
      this.coursesRepository.findOneBy({ id: classEntity.courseId }),
    ]);

    if (!branch || branch.status !== BranchStatus.ACTIVE) {
      throw new BadRequestException(
        'Chi nhánh của lớp hiện không hoạt động',
      );
    }

    if (!course || course.status !== CourseStatus.ACTIVE) {
      throw new BadRequestException('Khóa học của lớp hiện không hoạt động');
    }
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'endTime phải lớn hơn startTime (18:00 → 20:00)',
      );
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

  private conflictException(
    message: string,
    details: ScheduleConflictDetails,
  ): ConflictException {
    return new ConflictException({
      code: 'SCHEDULE_CONFLICT',
      message,
      details,
    });
  }

  private teacherConflictMessage(
    teacherName: string | undefined,
    className: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
  ): string {
    const who = teacherName ? `Giáo viên ${teacherName}` : 'Giáo viên';
    return `${who} đã có lịch dạy lớp "${className}" vào ${DAY_LABELS[dayOfWeek]} ${startTime} - ${endTime}`;
  }

  /**
   * Rejects when the new/updated time window overlaps an existing schedule for
   * the SAME class on the SAME day. Boundary touches (20:00 vs 20:00) are allowed.
   */
  private async assertNoClassConflict(
    classId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.schedulesRepository.find({
      where: { classId, dayOfWeek },
    });

    for (const sched of existing) {
      if (excludeId && sched.id === excludeId) {
        continue;
      }
      if (
        this.isOverlapping(startTime, endTime, sched.startTime, sched.endTime)
      ) {
        throw this.conflictException(
          `Lịch học bị trùng khung giờ với buổi ${DAY_LABELS[dayOfWeek]} hiện có (${sched.startTime} - ${sched.endTime})`,
          {
            type: 'class',
            dayOfWeek,
            dayLabel: DAY_LABELS[dayOfWeek],
            startTime: sched.startTime,
            endTime: sched.endTime,
          },
        );
      }
    }
  }

  /**
   * Teacher conflict check. Given the teacher currently assigned to the class,
   * find every class that teacher is assigned to (other than the target class)
   * and reject if any of their schedules overlap with the requested window on
   * the same day. The conflicting class and teacher names are attached to the
   * error so the UI can explain exactly why the schedule cannot be created.
   */
  private async assertNoTeacherConflict(
    organizationId: string,
    classId: string,
    teacherId: string | null | undefined,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string,
  ): Promise<void> {
    if (!teacherId) {
      return;
    }

    const schedules = await this.schedulesRepository
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.class', 'class')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'user')
      .where('class.organizationId = :organizationId', { organizationId })
      .andWhere('class.teacherId = :teacherId', { teacherId })
      .andWhere('class.id != :classId', { classId })
      .andWhere('class.lifecycleStatus != :cancelledStatus', {
        cancelledStatus: ClassLifecycleStatus.CANCELLED,
      })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .getMany();

    for (const sched of schedules) {
      if (excludeScheduleId && sched.id === excludeScheduleId) {
        continue;
      }
      if (
        this.isOverlapping(startTime, endTime, sched.startTime, sched.endTime)
      ) {
        const className = sched.class?.name ?? 'lớp khác';
        const teacherName = sched.class?.teacher?.user?.fullName ?? undefined;
        throw this.conflictException(
          this.teacherConflictMessage(
            teacherName,
            className,
            dayOfWeek,
            sched.startTime,
            sched.endTime,
          ),
          {
            type: 'teacher',
            dayOfWeek,
            dayLabel: DAY_LABELS[dayOfWeek],
            startTime: sched.startTime,
            endTime: sched.endTime,
            teacherName,
            className,
          },
        );
      }
    }
  }

  async create(
    userId: string,
    classId: string,
    createScheduleDto: CreateScheduleDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.assertClassEditable(organizationId, classId);
    await this.assertBranchAndCourseActive(classEntity);
    const { dayOfWeek, startTime, endTime, room } = createScheduleDto;

    this.validateTimeRange(startTime, endTime);
    await this.assertNoClassConflict(classId, dayOfWeek, startTime, endTime);
    await this.assertNoTeacherConflict(
      organizationId,
      classId,
      classEntity.teacherId,
      dayOfWeek,
      startTime,
      endTime,
    );

    const schedule = this.schedulesRepository.create({
      classId,
      dayOfWeek,
      startTime,
      endTime,
      room: room ?? null,
    });

    return this.schedulesRepository.save(schedule);
  }

  /**
   * Creates many weekly sessions for a class atomically. Validates every
   * session's time range, checks conflicts against the class's own schedules
   * and the teacher's other classes, and rejects on ANY conflict — including
   * conflicts between the new sessions themselves. Nothing is written unless
   * every session passes.
   */
  async createBulk(
    userId: string,
    classId: string,
    createSessionsDto: CreateSessionsDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.assertClassEditable(organizationId, classId);
    const sessions = createSessionsDto.sessions;

    await this.assertBranchAndCourseActive(classEntity);

    for (const session of sessions) {
      this.validateTimeRange(session.startTime, session.endTime);
    }

    // Conflicts between the new sessions themselves (2+ sessions on the same
    // day and overlapping time — keeps them all in one request consistent).
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (
          a.dayOfWeek === b.dayOfWeek &&
          this.isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)
        ) {
          throw this.conflictException(
            `Hai buổi đều vào ${DAY_LABELS[a.dayOfWeek]} trùng khung giờ (${b.startTime} - ${b.endTime})`,
            {
              type: 'internal',
              dayOfWeek: a.dayOfWeek,
              dayLabel: DAY_LABELS[a.dayOfWeek],
              startTime: b.startTime,
              endTime: b.endTime,
            },
          );
        }
      }
    }

    // Conflicts with the class's existing schedules (all days at once).
    const existingClassSchedules = await this.schedulesRepository.find({
      where: { classId },
    });

    for (const session of sessions) {
      for (const sched of existingClassSchedules) {
        if (
          session.dayOfWeek === sched.dayOfWeek &&
          this.isOverlapping(
            session.startTime,
            session.endTime,
            sched.startTime,
            sched.endTime,
          )
        ) {
          throw this.conflictException(
            `Lịch học bị trùng khung giờ với buổi ${DAY_LABELS[sched.dayOfWeek]} hiện có (${sched.startTime} - ${sched.endTime})`,
            {
              type: 'class',
              dayOfWeek: sched.dayOfWeek,
              dayLabel: DAY_LABELS[sched.dayOfWeek],
              startTime: sched.startTime,
              endTime: sched.endTime,
            },
          );
        }
      }
    }

    // Conflicts with the teacher's schedules in other classes (all days).
    if (classEntity.teacherId) {
      const teacherSchedules = await this.schedulesRepository
        .createQueryBuilder('schedule')
        .innerJoinAndSelect('schedule.class', 'class')
        .leftJoinAndSelect('class.teacher', 'teacher')
        .leftJoinAndSelect('teacher.user', 'user')
        .where('class.organizationId = :organizationId', { organizationId })
        .andWhere('class.teacherId = :teacherId', {
          teacherId: classEntity.teacherId,
        })
        .andWhere('class.id != :classId', { classId })
        .andWhere('class.lifecycleStatus != :cancelledStatus', {
          cancelledStatus: ClassLifecycleStatus.CANCELLED,
        })
        .getMany();

      for (const session of sessions) {
        for (const sched of teacherSchedules) {
          if (
            session.dayOfWeek === sched.dayOfWeek &&
            this.isOverlapping(
              session.startTime,
              session.endTime,
              sched.startTime,
              sched.endTime,
            )
          ) {
            const className = sched.class?.name ?? 'lớp khác';
            const teacherName =
              sched.class?.teacher?.user?.fullName ?? undefined;
            throw this.conflictException(
              this.teacherConflictMessage(
                teacherName,
                className,
                sched.dayOfWeek,
                sched.startTime,
                sched.endTime,
              ),
              {
                type: 'teacher',
                dayOfWeek: sched.dayOfWeek,
                dayLabel: DAY_LABELS[sched.dayOfWeek],
                startTime: sched.startTime,
                endTime: sched.endTime,
                teacherName,
                className,
              },
            );
          }
        }
      }
    }

    const schedules = sessions.map((session) =>
      this.schedulesRepository.create({
        classId,
        dayOfWeek: session.dayOfWeek,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room ?? null,
      }),
    );

    return this.dataSource.transaction(async (manager) =>
      manager.save(schedules),
    );
  }

  async findAll(
    userId: string,
    classId: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    await this.assertClassEditable(organizationId, classId);

    return this.schedulesRepository.find({
      where: { classId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async update(
    userId: string,
    id: string,
    updateScheduleDto: UpdateScheduleDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const schedule = await this.schedulesRepository.findOneBy({ id });
    if (!schedule) {
      throw new NotFoundException('Lịch học không tồn tại');
    }

    // The schedule's owning class must belong to the current organization.
    const classEntity = await this.assertClassEditable(
      organizationId,
      schedule.classId,
    );

    const dayOfWeek = updateScheduleDto.dayOfWeek ?? schedule.dayOfWeek;
    const startTime = updateScheduleDto.startTime ?? schedule.startTime;
    const endTime = updateScheduleDto.endTime ?? schedule.endTime;
    const room =
      updateScheduleDto.room !== undefined
        ? updateScheduleDto.room
        : schedule.room;

    this.validateTimeRange(startTime, endTime);
    await this.assertNoClassConflict(
      schedule.classId,
      dayOfWeek,
      startTime,
      endTime,
      id,
    );
    await this.assertNoTeacherConflict(
      organizationId,
      schedule.classId,
      classEntity.teacherId,
      dayOfWeek,
      startTime,
      endTime,
      id,
    );

    schedule.dayOfWeek = dayOfWeek;
    schedule.startTime = startTime;
    schedule.endTime = endTime;
    schedule.room = room;

    return this.schedulesRepository.save(schedule);
  }

  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(userId, organizationId);

    const schedule = await this.schedulesRepository.findOneBy({ id });
    if (!schedule) {
      throw new NotFoundException('Lịch học không tồn tại');
    }

    // Verify the owning class belongs to the current organization before delete.
    await this.assertClassEditable(organizationId, schedule.classId);

    return this.schedulesRepository.remove(schedule);
  }
}
