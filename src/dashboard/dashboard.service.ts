import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Student, StudentStatus } from '../students/entities/student.entity';
import { Teacher, TeacherStatus } from '../teachers/entities/teacher.entity';
import { Class, ClassLifecycleStatus } from '../classes/entities/class.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../attendance/enums/attendance-status.enum';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

export interface DashboardStatisticsResponse {
  students: {
    total: number;
    active: number;
  };
  teachers: {
    total: number;
    active: number;
  };
  classes: {
    total: number;
    active: number;
    upcoming: number;
    ongoing: number;
    completed: number;
  };
  attendance: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number | null;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(ClassSession)
    private readonly sessionsRepository: Repository<ClassSession>,
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

  private roundRate(rate: number): number {
    return Math.round(rate * 100) / 100;
  }

  async getStatistics(
    userId: string,
    options: OrgContextOptions = {},
  ): Promise<DashboardStatisticsResponse> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const [
      studentStats,
      teacherStats,
      classStats,
      attendanceStats,
      classLifecycleCounts,
    ] = await Promise.all([
      this.studentsRepository
        .createQueryBuilder('student')
        .where('student.organizationId = :organizationId', { organizationId })
        .select([
          `COUNT(*)::int AS "total"`,
          `COUNT(*) FILTER (WHERE student.status = :active)::int AS "active"`,
        ])
        .setParameters({ active: StudentStatus.ACTIVE })
        .getRawOne<{ total: string; active: string }>(),

      this.teachersRepository
        .createQueryBuilder('teacher')
        .where('teacher."organizationId" = :organizationId', { organizationId })
        .select([
          `COUNT(*)::int AS "total"`,
          `COUNT(*) FILTER (WHERE teacher.status = :active)::int AS "active"`,
        ])
        .setParameters({ active: TeacherStatus.ACTIVE })
        .getRawOne<{ total: string; active: string }>(),

      this.classesRepository
        .createQueryBuilder('class')
        .where('class.organization_id = :organizationId', { organizationId })
        .select([
          `COUNT(*)::int AS "total"`,
          `COUNT(*) FILTER (WHERE class.status = :activeStatus AND class.lifecycle_status != :cancelled)::int AS "active"`,
        ])
        .setParameters({
          activeStatus: 'ACTIVE',
          cancelled: ClassLifecycleStatus.CANCELLED,
        })
        .getRawOne<{ total: string; active: string }>(),

      this.attendancesRepository
        .createQueryBuilder('attendance')
        .innerJoin('attendance.session', 'session')
        .where('session.organizationId = :organizationId', { organizationId })
        .select([
          `COUNT(*)::int AS "total"`,
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
          total: string;
          present: string;
          late: string;
          absent: string;
          excused: string;
        }>(),

      this.classesRepository
        .createQueryBuilder('class')
        .where('class.organization_id = :organizationId', { organizationId })
        .select([
          `COUNT(*) FILTER (WHERE class.lifecycle_status = :upcoming)::int AS "upcoming"`,
          `COUNT(*) FILTER (WHERE class.lifecycle_status = :ongoing)::int AS "ongoing"`,
          `COUNT(*) FILTER (WHERE class.lifecycle_status = :completed)::int AS "completed"`,
        ])
        .setParameters({
          upcoming: ClassLifecycleStatus.UPCOMING,
          ongoing: ClassLifecycleStatus.ONGOING,
          completed: ClassLifecycleStatus.COMPLETED,
        })
        .getRawOne<{ upcoming: string; ongoing: string; completed: string }>(),
    ]);

    const totalAttendance = parseInt(attendanceStats?.total ?? '0', 10);
    const present = parseInt(attendanceStats?.present ?? '0', 10);
    const late = parseInt(attendanceStats?.late ?? '0', 10);
    const absent = parseInt(attendanceStats?.absent ?? '0', 10);
    const excused = parseInt(attendanceStats?.excused ?? '0', 10);

    let attendanceRate: number | null = null;
    if (totalAttendance > 0) {
      attendanceRate = this.roundRate(
        ((present + late) / totalAttendance) * 100,
      );
    }

    return {
      students: {
        total: parseInt(studentStats?.total ?? '0', 10),
        active: parseInt(studentStats?.active ?? '0', 10),
      },
      teachers: {
        total: parseInt(teacherStats?.total ?? '0', 10),
        active: parseInt(teacherStats?.active ?? '0', 10),
      },
      classes: {
        total: parseInt(classStats?.total ?? '0', 10),
        active: parseInt(classStats?.active ?? '0', 10),
        upcoming: parseInt(classLifecycleCounts?.upcoming ?? '0', 10),
        ongoing: parseInt(classLifecycleCounts?.ongoing ?? '0', 10),
        completed: parseInt(classLifecycleCounts?.completed ?? '0', 10),
      },
      attendance: {
        total: totalAttendance,
        present,
        late,
        absent,
        excused,
        attendanceRate,
      },
    };
  }
}
