import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Class } from '../classes/entities/class.entity';
import { Student } from '../students/entities/student.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../attendance/enums/attendance-status.enum';
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
