import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  Class,
  ClassLifecycleStatus,
  ClassStatus,
} from '../classes/entities/class.entity';
import { Student } from '../students/entities/student.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../attendance/enums/attendance-status.enum';
import { DayOfWeek } from '../schedules/entities/schedule.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

export interface ClassAttendanceSummaryResponse {
  classId: string;
  totalSessions: number;
  recordedSessions: number;
  totalAttendance: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number | null;
}

export interface StudentAttendanceSummaryResponse {
  studentId: string;
  totalSessions: number;
  recordedSessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendedSessions: number;
  missedSessions: number;
  attendanceRate: number | null;
}

export interface AttendanceHistoryItem {
  sessionId: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface AttendanceHistoryResponse {
  studentId: string;
  items: AttendanceHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceHistoryOptions extends OrgContextOptions {
  classId?: string;
  page?: number;
  limit?: number;
}

interface AttendanceHistoryRawRow {
  sessionId: string;
  classId: string;
  className: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  status: string | null;
  note: string | null;
}

export interface ClassAttendanceCard {
  id: string;
  name: string;
  code: string;
  courseName: string;
  branchName: string;
  teacherName: string | null;
  studentCount: number;
  capacity: number;
  scheduleDays: string[];
  scheduleTimeStart: string | null;
  scheduleTimeEnd: string | null;
  lifecycleStatus: ClassLifecycleStatus;
  startDate: string;
  endDate: string;
}

export interface ClassAttendanceCardsResponse {
  items: ClassAttendanceCard[];
  total: number;
  page: number;
  limit: number;
}

export interface ClassAttendanceCardsOptions extends OrgContextOptions {
  search?: string;
  branchId?: string;
  teacherId?: string;
  page?: number;
  limit?: number;
}

export interface ClassStudentAttendanceRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  totalSessions: number;
  recordedSessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendedSessions: number;
  missedSessions: number;
  attendanceRate: number | null;
}

export interface ClassStudentsAttendanceResponse {
  classId: string;
  className: string;
  classCode: string;
  teacher: { id: string; name: string } | null;
  totalStudents: number;
  rows: ClassStudentAttendanceRow[];
}

export interface ClassStudentsAttendanceOptions extends OrgContextOptions {
  startDate?: string;
  endDate?: string;
}

interface StudentAttendanceStats {
  recordedSessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'T2',
  TUESDAY: 'T3',
  WEDNESDAY: 'T4',
  THURSDAY: 'T5',
  FRIDAY: 'T6',
  SATURDAY: 'T7',
  SUNDAY: 'CN',
};

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(ClassSession)
    private readonly sessionsRepository: Repository<ClassSession>,
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
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
      throw new NotFoundException(
        'User does not have access to this organization',
      );
    }

    return membership.organizationId;
  }

  private roundRate(rate: number): number {
    return Math.round(rate * 100) / 100;
  }

  async getClassAttendanceSummary(
    userId: string,
    classId: string,
    options: OrgContextOptions = {},
  ): Promise<ClassAttendanceSummaryResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.classesRepository.findOneBy({
      id: classId,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    const totalSessionsResult = await this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.organizationId = :organizationId', { organizationId })
      .getCount();

    const recordedSessionsResult = await this.attendancesRepository
      .createQueryBuilder('attendance')
      .innerJoin('attendance.session', 'session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.organizationId = :organizationId', { organizationId })
      .select('COUNT(DISTINCT attendance.sessionId)', 'count')
      .getRawOne<{ count: string }>();

    const recordedSessions = parseInt(recordedSessionsResult?.count ?? '0', 10);

    const statsResult = await this.attendancesRepository
      .createQueryBuilder('attendance')
      .innerJoin('attendance.session', 'session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.organizationId = :organizationId', { organizationId })
      .select([
        `COUNT(*)::int AS "totalAttendance"`,
        `COUNT(*) FILTER (WHERE attendance.status = :present)::int AS "present"`,
        `COUNT(*) FILTER (WHERE attendance.status = :late)::int AS "late"`,
        `COUNT(*) FILTER (WHERE attendance.status = :absent)::int AS "absent"`,
        `COUNT(*) FILTER (WHERE attendance.status = :excused)::int AS "excused"`,
      ])
      .setParameters({
        present: AttendanceStatus.PRESENT,
        late: AttendanceStatus.LATE,
        absent: AttendanceStatus.ABSENT,
        excused: AttendanceStatus.EXCUSED,
      })
      .getRawOne<{
        totalAttendance: string;
        present: string;
        late: string;
        absent: string;
        excused: string;
      }>();

    const totalAttendance = parseInt(statsResult?.totalAttendance ?? '0', 10);
    const present = parseInt(statsResult?.present ?? '0', 10);
    const late = parseInt(statsResult?.late ?? '0', 10);
    const absent = parseInt(statsResult?.absent ?? '0', 10);
    const excused = parseInt(statsResult?.excused ?? '0', 10);

    let attendanceRate: number | null = null;
    if (totalAttendance > 0) {
      attendanceRate = this.roundRate(
        ((present + late) / totalAttendance) * 100,
      );
    }

    return {
      classId,
      totalSessions: totalSessionsResult,
      recordedSessions,
      totalAttendance,
      present,
      late,
      absent,
      excused,
      attendanceRate,
    };
  }

  async getStudentAttendanceSummary(
    userId: string,
    studentId: string,
    options: OrgContextOptions = {},
  ): Promise<StudentAttendanceSummaryResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const student = await this.studentsRepository.findOneBy({
      id: studentId,
      organizationId,
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const classIds = await this.resolveEnrollmentClassIds(
      organizationId,
      studentId,
    );
    const [totalSessions, stats] = await Promise.all([
      this.countOccurredSessions(organizationId, classIds),
      this.aggregateStudentAttendance(organizationId, studentId, classIds),
    ]);

    const attendedSessions = stats.present + stats.late;
    const missedSessions = stats.absent + stats.excused;
    const attendanceRate =
      stats.recordedSessions > 0
        ? this.roundRate((attendedSessions / stats.recordedSessions) * 100)
        : null;

    return {
      studentId,
      totalSessions,
      recordedSessions: stats.recordedSessions,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      excused: stats.excused,
      attendedSessions,
      missedSessions,
      attendanceRate,
    };
  }

  async getStudentAttendanceSummaryForClass(
    userId: string,
    studentId: string,
    classId: string,
    options: OrgContextOptions = {},
  ): Promise<StudentAttendanceSummaryResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const student = await this.studentsRepository.findOneBy({
      id: studentId,
      organizationId,
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const classEntity = await this.classesRepository.findOneBy({
      id: classId,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    const enrollment = await this.enrollmentsRepository.findOneBy({
      studentId,
      classId,
      status: In([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
    });

    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this class');
    }

    const classIds = [classId];
    const [totalSessions, stats] = await Promise.all([
      this.countOccurredSessions(organizationId, classIds),
      this.aggregateStudentAttendance(organizationId, studentId, classIds),
    ]);

    const attendedSessions = stats.present + stats.late;
    const missedSessions = stats.absent + stats.excused;
    const attendanceRate =
      stats.recordedSessions > 0
        ? this.roundRate((attendedSessions / stats.recordedSessions) * 100)
        : null;

    return {
      studentId,
      totalSessions,
      recordedSessions: stats.recordedSessions,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      excused: stats.excused,
      attendedSessions,
      missedSessions,
      attendanceRate,
    };
  }

  async getStudentAttendanceHistory(
    userId: string,
    studentId: string,
    options: AttendanceHistoryOptions = {},
  ): Promise<AttendanceHistoryResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const student = await this.studentsRepository.findOneBy({
      id: studentId,
      organizationId,
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const classIds = options.classId
      ? await this.resolveSingleClassForStudent(
          organizationId,
          studentId,
          options.classId,
        )
      : await this.resolveEnrollmentClassIds(organizationId, studentId);

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    if (classIds.length === 0) {
      return { studentId, items: [], total: 0, page, limit };
    }

    const today = this.todayDate();

    const [total, rows] = await Promise.all([
      this.buildStudentHistoryQuery(
        organizationId,
        studentId,
        classIds,
        today,
      ).getCount(),
      this.buildStudentHistoryQuery(organizationId, studentId, classIds, today)
        .select([
          'session.id AS "sessionId"',
          'class.id AS "classId"',
          'class.name AS "className"',
          'session.sessionDate AS "date"',
          'session.startTime AS "startTime"',
          'session.endTime AS "endTime"',
          'attendance.status AS "status"',
          'attendance.note AS "note"',
        ])
        .orderBy('session.sessionDate', 'DESC')
        .addOrderBy('session.startTime', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getRawMany<AttendanceHistoryRawRow>(),
    ]);

    const items = rows.map((row) => ({
      sessionId: row.sessionId,
      classId: row.classId,
      className: row.className,
      date: this.toDateString(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status ? (row.status as AttendanceStatus) : null,
      note: row.note ?? null,
    }));

    return { studentId, items, total, page, limit };
  }

  async getClassAttendanceCards(
    userId: string,
    options: OrgContextOptions = {},
    filters: ClassAttendanceCardsOptions = {},
  ): Promise<ClassAttendanceCardsResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const search = (filters.search ?? '').trim();

    const qb = this.classesRepository
      .createQueryBuilder('class')
      .innerJoinAndSelect('class.branch', 'branch')
      .innerJoinAndSelect('class.course', 'course')
      .leftJoinAndSelect('class.teacher', 'teacher')
      .leftJoinAndSelect('teacher.user', 'teacherUser')
      .leftJoinAndSelect('class.schedules', 'schedule')
      .where('class.organizationId = :organizationId', { organizationId })
      .andWhere('class.status = :status', { status: ClassStatus.ACTIVE });

    if (filters.branchId) {
      qb.andWhere('class.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }

    if (filters.teacherId) {
      qb.andWhere('class.teacherId = :teacherId', {
        teacherId: filters.teacherId,
      });
    }

    if (search) {
      qb.andWhere(
        '(class.name ILIKE :search OR class.code ILIKE :search OR course.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('class.createdAt', 'DESC');

    const classes = await qb.getMany();
    const counts = await this.getActiveStudentCountsByClass(
      organizationId,
      classes.map((classEntity) => classEntity.id),
    );

    const items = classes.map((classEntity) =>
      this.toClassAttendanceCard(classEntity, counts.get(classEntity.id) ?? 0),
    );

    const total = items.length;
    const offset = (page - 1) * limit;

    return {
      items: items.slice(offset, offset + limit),
      total,
      page,
      limit,
    };
  }

  async getClassStudentsAttendance(
    userId: string,
    classId: string,
    options: ClassStudentsAttendanceOptions = {},
  ): Promise<ClassStudentsAttendanceResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const classEntity = await this.classesRepository.findOne({
      where: { id: classId, organizationId },
      relations: { teacher: { user: true } },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    const enrollments = await this.enrollmentsRepository.find({
      where: { classId, status: EnrollmentStatus.ACTIVE },
      relations: { student: { user: true } },
      order: { enrolledAt: 'ASC' },
    });

    const sessionQb = this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.classId = :classId', { classId })
      .andWhere('session.organizationId = :organizationId', { organizationId })
      .andWhere('session.sessionDate <= :today', { today: this.todayDate() });

    if (options.startDate) {
      sessionQb.andWhere('session.sessionDate >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      sessionQb.andWhere('session.sessionDate <= :endDate', {
        endDate: options.endDate,
      });
    }

    const sessions = await sessionQb.getMany();
    const sessionIds = sessions.map((session) => session.id);
    const totalSessions = sessionIds.length;

    const statsByStudent =
      sessionIds.length > 0
        ? await this.aggregateClassAttendanceByStudent(
            organizationId,
            sessionIds,
          )
        : new Map<string, StudentAttendanceStats>();

    const rows = enrollments.map((enrollment) => {
      const student = enrollment.student;
      const stats = statsByStudent.get(student.id) ?? {
        recordedSessions: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
      const attendedSessions = stats.present + stats.late;
      const missedSessions = stats.absent + stats.excused;
      const attendanceRate =
        stats.recordedSessions > 0
          ? this.roundRate((attendedSessions / stats.recordedSessions) * 100)
          : null;

      return {
        studentId: student.id,
        studentCode: student.studentCode,
        fullName: student.user?.fullName ?? '',
        totalSessions,
        recordedSessions: stats.recordedSessions,
        present: stats.present,
        late: stats.late,
        absent: stats.absent,
        excused: stats.excused,
        attendedSessions,
        missedSessions,
        attendanceRate,
      };
    });

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    return {
      classId,
      className: classEntity.name,
      classCode: classEntity.code,
      teacher: classEntity.teacher
        ? {
            id: classEntity.teacher.id,
            name: classEntity.teacher.user?.fullName ?? '',
          }
        : null,
      totalStudents: rows.length,
      rows,
    };
  }

  private async getActiveStudentCountsByClass(
    organizationId: string,
    classIds: string[],
  ): Promise<Map<string, number>> {
    if (classIds.length === 0) {
      return new Map();
    }

    const rows = await this.classesRepository
      .createQueryBuilder('class')
      .innerJoin(
        'class.enrollments',
        'enrollment',
        'enrollment.status = :status',
        { status: EnrollmentStatus.ACTIVE },
      )
      .where('class.organizationId = :organizationId', { organizationId })
      .andWhere('class.id IN (:...classIds)', { classIds })
      .select('class.id', 'classId')
      .addSelect('COUNT(enrollment.id)::int', 'studentCount')
      .groupBy('class.id')
      .getRawMany<{ classId: string; studentCount: string }>();

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.classId, parseInt(row.studentCount, 10));
    }
    return counts;
  }

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

  private toClassAttendanceCard(
    classEntity: Class,
    studentCount: number,
  ): ClassAttendanceCard {
    const days = Array.from(
      new Set(classEntity.schedules.map((schedule) => schedule.dayOfWeek)),
    )
      .sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b])
      .map((day) => DAY_SHORT_LABELS[day]);

    let scheduleTimeStart: string | null = null;
    let scheduleTimeEnd: string | null = null;
    for (const schedule of classEntity.schedules) {
      const start = this.toHmTime(schedule.startTime);
      const end = this.toHmTime(schedule.endTime);
      if (scheduleTimeStart === null || start < scheduleTimeStart) {
        scheduleTimeStart = start;
      }
      if (scheduleTimeEnd === null || end > scheduleTimeEnd) {
        scheduleTimeEnd = end;
      }
    }

    return {
      id: classEntity.id,
      name: classEntity.name,
      code: classEntity.code,
      courseName: classEntity.course?.name ?? '',
      branchName: classEntity.branch?.name ?? '',
      teacherName: classEntity.teacher?.user?.fullName ?? null,
      studentCount,
      capacity: classEntity.capacity,
      scheduleDays: days,
      scheduleTimeStart,
      scheduleTimeEnd,
      lifecycleStatus: this.computeLifecycleStatus(classEntity),
      startDate: this.toDateString(classEntity.startDate),
      endDate: this.toDateString(classEntity.endDate),
    };
  }

  private async aggregateClassAttendanceByStudent(
    organizationId: string,
    sessionIds: string[],
  ): Promise<Map<string, StudentAttendanceStats>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const rows = await this.attendancesRepository
      .createQueryBuilder('attendance')
      .where('attendance.organizationId = :organizationId', { organizationId })
      .andWhere('attendance.sessionId IN (:...sessionIds)', { sessionIds })
      .select('attendance.studentId', 'studentId')
      .addSelect('COUNT(*)::int', 'recordedSessions')
      .addSelect(
        `COUNT(*) FILTER (WHERE attendance.status = :present)::int`,
        'present',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE attendance.status = :late)::int`,
        'late',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE attendance.status = :absent)::int`,
        'absent',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE attendance.status = :excused)::int`,
        'excused',
      )
      .setParameters({
        present: AttendanceStatus.PRESENT,
        late: AttendanceStatus.LATE,
        absent: AttendanceStatus.ABSENT,
        excused: AttendanceStatus.EXCUSED,
      })
      .groupBy('attendance.studentId')
      .getRawMany<{
        studentId: string;
        recordedSessions: string;
        present: string;
        late: string;
        absent: string;
        excused: string;
      }>();

    const statsByStudent = new Map<string, StudentAttendanceStats>();
    for (const row of rows) {
      statsByStudent.set(row.studentId, {
        recordedSessions: parseInt(row.recordedSessions, 10),
        present: parseInt(row.present, 10),
        late: parseInt(row.late, 10),
        absent: parseInt(row.absent, 10),
        excused: parseInt(row.excused, 10),
      });
    }
    return statsByStudent;
  }

  private toHmTime(value: string | Date): string {
    if (value instanceof Date) {
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return String(value).slice(0, 5);
  }

  private async resolveEnrollmentClassIds(
    organizationId: string,
    studentId: string,
  ): Promise<string[]> {
    const enrollments = await this.enrollmentsRepository.find({
      where: {
        studentId,
        status: In([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
        class: { organizationId },
      },
    });
    return enrollments.map((enrollment) => enrollment.classId);
  }

  private async resolveSingleClassForStudent(
    organizationId: string,
    studentId: string,
    classId: string,
  ): Promise<string[]> {
    const classEntity = await this.classesRepository.findOneBy({
      id: classId,
      organizationId,
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    const enrollment = await this.enrollmentsRepository.findOneBy({
      studentId,
      classId,
      status: In([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
    });

    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this class');
    }

    return [classId];
  }

  private async countOccurredSessions(
    organizationId: string,
    classIds: string[],
  ): Promise<number> {
    if (classIds.length === 0) {
      return 0;
    }

    return this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.organizationId = :organizationId', { organizationId })
      .andWhere('session.classId IN (:...classIds)', { classIds })
      .andWhere('session.sessionDate <= :today', { today: this.todayDate() })
      .getCount();
  }

  private async aggregateStudentAttendance(
    organizationId: string,
    studentId: string,
    classIds: string[],
  ): Promise<{
    recordedSessions: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  }> {
    if (classIds.length === 0) {
      return {
        recordedSessions: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
    }

    const statsResult = await this.attendancesRepository
      .createQueryBuilder('attendance')
      .innerJoin('attendance.session', 'session')
      .where('attendance.studentId = :studentId', { studentId })
      .andWhere('attendance.organizationId = :organizationId', {
        organizationId,
      })
      .andWhere('session.classId IN (:...classIds)', { classIds })
      .select([
        `COUNT(*)::int AS "recordedSessions"`,
        `COUNT(*) FILTER (WHERE attendance.status = :present)::int AS "present"`,
        `COUNT(*) FILTER (WHERE attendance.status = :late)::int AS "late"`,
        `COUNT(*) FILTER (WHERE attendance.status = :absent)::int AS "absent"`,
        `COUNT(*) FILTER (WHERE attendance.status = :excused)::int AS "excused"`,
      ])
      .setParameters({
        present: AttendanceStatus.PRESENT,
        late: AttendanceStatus.LATE,
        absent: AttendanceStatus.ABSENT,
        excused: AttendanceStatus.EXCUSED,
      })
      .getRawOne<{
        recordedSessions: string;
        present: string;
        late: string;
        absent: string;
        excused: string;
      }>();

    return {
      recordedSessions: parseInt(statsResult?.recordedSessions ?? '0', 10),
      present: parseInt(statsResult?.present ?? '0', 10),
      late: parseInt(statsResult?.late ?? '0', 10),
      absent: parseInt(statsResult?.absent ?? '0', 10),
      excused: parseInt(statsResult?.excused ?? '0', 10),
    };
  }

  private buildStudentHistoryQuery(
    organizationId: string,
    studentId: string,
    classIds: string[],
    today: string,
  ) {
    return this.sessionsRepository
      .createQueryBuilder('session')
      .innerJoin('session.class', 'class')
      .leftJoin(
        Attendance,
        'attendance',
        'attendance.sessionId = session.id AND attendance.studentId = :studentId',
        { studentId },
      )
      .where('session.organizationId = :organizationId', { organizationId })
      .andWhere('session.classId IN (:...classIds)', { classIds })
      .andWhere('session.sessionDate <= :today', { today });
  }

  private todayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toDateString(value: string | Date): string {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(value).slice(0, 10);
  }
}
