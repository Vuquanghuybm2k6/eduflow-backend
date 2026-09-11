import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClassSession } from './entities/class-session.entity';
import { ClassSessionStatus } from './enums/class-session-status.enum';
import { ClassSessionType } from './enums/class-session-type.enum';
import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { DayOfWeek, Schedule } from '../schedules/entities/schedule.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { GenerateSessionsDto } from './dto/generate-sessions.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { Attendance } from '../attendance/entities/attendance.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

const DAY_OF_WEEK_TO_JS_DAY: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

const MAX_GENERATION_RANGE_DAYS = 366;

export interface GenerateResult {
  classId: string;
  startDate: string;
  endDate: string;
  created: number;
  skipped: number;
}

@Injectable()
export class ClassSessionsService {
  constructor(
    @InjectRepository(ClassSession)
    private readonly classSessionsRepository: Repository<ClassSession>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Schedule)
    private readonly schedulesRepository: Repository<Schedule>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
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
      throw new BadRequestException('Không thể tạo buổi học cho lớp đã bị hủy');
    }

    return classEntity;
  }

  private toDateString(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    return value.toISOString().slice(0, 10);
  }

  private toHmTime(value: string): string {
    return value.length > 5 ? value.slice(0, 5) : value;
  }

  private toSessionResponse(session: ClassSession) {
    const teacher =
      session.teacher && session.teacher.user?.fullName
        ? {
            id: session.teacher.id,
            name: session.teacher.user.fullName,
          }
        : null;

    return {
      id: session.id,
      classId: session.classId,
      scheduleId: session.scheduleId,
      teacherId: session.teacherId,
      sessionDate: this.toDateString(session.sessionDate),
      startTime: this.toHmTime(session.startTime),
      endTime: this.toHmTime(session.endTime),
      room: session.room,
      type: session.type,
      status: session.status,
      note: session.note,
      teacher,
    };
  }

  private parseDateKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    const err = error as {
      driverError?: { code?: string };
      code?: string;
    };
    const code = err.driverError?.code ?? err.code;
    return code === '23505';
  }

  /** Returns existing session dates for this class inside the given range. */
  private async findExistingSessionDates(
    classId: string,
    startDate: string,
    endDate: string,
  ): Promise<Set<string>> {
    const rows = await this.classSessionsRepository
      .createQueryBuilder('session')
      .select(`TO_CHAR(session.session_date, 'YYYY-MM-DD')`, 'sessionDate')
      .where('session.class_id = :classId', { classId })
      .andWhere('session.session_date >= :start', { start: startDate })
      .andWhere('session.session_date <= :end', { end: endDate })
      .getRawMany<{ sessionDate: string }>();

    return new Set(rows.map((row) => row.sessionDate));
  }

  async generate(
    userId: string,
    classId: string,
    dto: GenerateSessionsDto,
    options: OrgContextOptions = {},
  ): Promise<GenerateResult> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(userId, organizationId);

    const classEntity = await this.assertClassEditable(organizationId, classId);

    if (!classEntity.teacherId) {
      throw new BadRequestException(
        'Lớp học chưa có giáo viên. Vui lòng gán giáo viên trước khi tạo buổi học',
      );
    }

    const requestedStart = this.parseDateKey(dto.startDate);
    const requestedEnd = this.parseDateKey(dto.endDate);

    if (Number.isNaN(requestedStart.getTime())) {
      throw new BadRequestException('startDate không hợp lệ');
    }
    if (Number.isNaN(requestedEnd.getTime())) {
      throw new BadRequestException('endDate không hợp lệ');
    }
    if (requestedStart > requestedEnd) {
      throw new BadRequestException('startDate không được lớn hơn endDate');
    }

    const rangeDays =
      (requestedEnd.getTime() - requestedStart.getTime()) /
      (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_GENERATION_RANGE_DAYS) {
      throw new BadRequestException(
        `Khoảng thời gian tối đa là ${MAX_GENERATION_RANGE_DAYS} ngày`,
      );
    }

    const schedules = await this.schedulesRepository.find({
      where: { classId },
    });

    if (schedules.length === 0) {
      throw new BadRequestException(
        'Lớp học chưa có lịch học. Vui lòng thêm lịch học trước khi tạo buổi học',
      );
    }

    // Intersect requested range with the class date window.
    const classStart = this.parseDateKey(
      this.toDateString(classEntity.startDate),
    );
    const classEnd = this.parseDateKey(this.toDateString(classEntity.endDate));

    const effectiveStart =
      classStart > requestedStart ? classStart : requestedStart;
    const effectiveEnd = classEnd < requestedEnd ? classEnd : requestedEnd;

    if (effectiveStart > effectiveEnd) {
      return {
        classId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        created: 0,
        skipped: 0,
      };
    }

    const effectiveStartStr = this.toDateString(effectiveStart);
    const effectiveEndStr = this.toDateString(effectiveEnd);

    const daySchedulesByJsDay = new Map<number, Schedule[]>();
    for (const sched of schedules) {
      const jsDay = DAY_OF_WEEK_TO_JS_DAY[sched.dayOfWeek];
      const list = daySchedulesByJsDay.get(jsDay) ?? [];
      list.push(sched);
      daySchedulesByJsDay.set(jsDay, list);
    }

    const existingDates = await this.findExistingSessionDates(
      classId,
      effectiveStartStr,
      effectiveEndStr,
    );

    let created = 0;
    let skipped = 0;
    const sessionsToCreate: Partial<ClassSession>[] = [];

    const cursor = new Date(effectiveStart);
    const endDateMs = effectiveEnd.getTime();

    while (cursor.getTime() <= endDateMs) {
      const jsDay = cursor.getDay();
      const dateKey = this.toDateString(cursor);
      const daySchedules = daySchedulesByJsDay.get(jsDay) ?? [];

      if (daySchedules.length > 0) {
        if (existingDates.has(dateKey)) {
          skipped++;
        } else {
          // One session per class per day (UNIQUE constraint). If a class has
          // multiple schedules on the same weekday, the first one wins.
          const sched = daySchedules[0];
          sessionsToCreate.push({
            organizationId,
            classId,
            scheduleId: sched.id,
            teacherId: classEntity.teacherId,
            sessionDate: this.parseDateKey(dateKey),
            startTime: sched.startTime,
            endTime: sched.endTime,
            room: sched.room,
            type: ClassSessionType.REGULAR,
            status: ClassSessionStatus.SCHEDULED,
          });
          created++;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (sessionsToCreate.length > 0) {
      try {
        // First request path: idempotent bulk insert. Sequential re-runs never
        // reach here because existingDates protects us.
        const entities = this.classSessionsRepository.create(sessionsToCreate);
        await this.classSessionsRepository.save(entities);
      } catch (error) {
        // Concurrent race path: another request created some of these rows just
        // after our read. Fall back to per-row insert, skipping duplicates.
        if (!this.isDuplicateKeyError(error)) {
          throw error;
        }

        created = 0;
        skipped = 0;
        for (const candidate of sessionsToCreate) {
          try {
            const entity = this.classSessionsRepository.create(candidate);
            await this.classSessionsRepository.save(entity);
            created++;
          } catch (rowError) {
            if (this.isDuplicateKeyError(rowError)) {
              skipped++;
              continue;
            }
            throw rowError;
          }
        }
      }
    }

    return {
      classId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      created,
      skipped,
    };
  }

  async findAll(
    userId: string,
    classId: string,
    query: SessionQueryDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    await this.assertClassEditable(organizationId, classId);

    const qb = this.classSessionsRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .where('session.class_id = :classId', { classId })
      .andWhere('session.organization_id = :organizationId', {
        organizationId,
      });

    if (query.startDate) {
      qb.andWhere('session.session_date >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      qb.andWhere('session.session_date <= :endDate', {
        endDate: query.endDate,
      });
    }

    if (query.status) {
      qb.andWhere('session.status = :status', {
        status: query.status,
      });
    }

    qb.orderBy('session.session_date', 'ASC').addOrderBy(
      'session.start_time',
      'ASC',
    );

    const sessions = await qb.getMany();

    let sessionIdsWithAttendance = new Set<string>();
    if (sessions.length > 0) {
      const attendanceRows = await this.attendancesRepository
        .createQueryBuilder('attendance')
        .select('attendance.session_id', 'sessionId')
        .where('attendance.session_id IN (:...ids)', {
          ids: sessions.map((session) => session.id),
        })
        .getRawMany<{ sessionId: string }>();
      sessionIdsWithAttendance = new Set(
        attendanceRows.map((row) => row.sessionId),
      );
    }

    return sessions.map((session) => ({
      ...this.toSessionResponse(session),
      hasAttendance: sessionIdsWithAttendance.has(session.id),
    }));
  }

  async findOne(
    userId: string,
    classId: string,
    sessionId: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const session = await this.classSessionsRepository.findOne({
      where: {
        id: sessionId,
        classId,
        organizationId,
      },
      relations: {
        class: { course: true },
        teacher: { user: true },
        schedule: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Buổi học không tồn tại');
    }

    const base = this.toSessionResponse(session);
    const targetClass = session.class;

    return {
      ...base,
      class: targetClass
        ? {
            id: targetClass.id,
            name: targetClass.name,
            code: targetClass.code,
          }
        : null,
      course: targetClass?.course
        ? {
            id: targetClass.course.id,
            name: targetClass.course.name,
          }
        : null,
      schedule: session.schedule
        ? {
            id: session.schedule.id,
            dayOfWeek: session.schedule.dayOfWeek,
            startTime: this.toHmTime(session.schedule.startTime),
            endTime: this.toHmTime(session.schedule.endTime),
            room: session.schedule.room,
          }
        : null,
    };
  }
}
