import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Attendance } from './entities/attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { ClassSessionStatus } from '../sessions/enums/class-session-status.enum';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity';
import { Teacher, TeacherStatus } from '../teachers/entities/teacher.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

export type AttendanceRoleKind = 'manager' | 'teacher' | 'student' | 'member';

export interface AttendanceUpdateSummary {
  sessionId: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Attendance)
    private readonly attendancesRepository: Repository<Attendance>,
    @InjectRepository(ClassSession)
    private readonly sessionsRepository: Repository<ClassSession>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
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

  private async resolveRoleKind(
    userId: string,
    organizationId: string,
  ): Promise<AttendanceRoleKind> {
    const membership = await this.membershipsRepository.findOne({
      where: { userId, organizationId, status: MembershipStatus.ACTIVE },
      relations: { role: true },
    });

    if (!membership || !membership.role) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    const roleName = membership.role.name.toLowerCase();
    if (roleName.includes('owner') || roleName.includes('admin')) {
      return 'manager';
    }
    if (roleName.includes('teacher')) {
      return 'teacher';
    }
    if (roleName.includes('student')) {
      return 'student';
    }
    return 'member';
  }

  private async findSessionInOrganization(
    sessionId: string,
    organizationId: string,
  ): Promise<ClassSession> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId, organizationId },
      relations: { class: { teacher: { user: true } } },
    });

    if (!session || !session.class) {
      throw new NotFoundException('Buổi học không tồn tại');
    }

    if (session.class.organizationId !== organizationId) {
      throw new NotFoundException('Buổi học không tồn tại');
    }

    return session;
  }

  private async resolveTeacher(
    userId: string,
    organizationId: string,
  ): Promise<Teacher> {
    const teacher = await this.teachersRepository.findOne({
      where: { userId, organizationId },
    });

    if (!teacher || teacher.status !== TeacherStatus.ACTIVE) {
      throw new ForbiddenException('Chỉ giáo viên của lớp mới được điểm danh');
    }

    return teacher;
  }

  private async findActiveEnrollmentsWithStudents(
    classId: string,
  ): Promise<Enrollment[]> {
    return this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .innerJoinAndSelect('enrollment.student', 'student')
      .innerJoinAndSelect('student.user', 'studentUser')
      .where('enrollment.classId = :classId', { classId })
      .andWhere('enrollment.status = :status', {
        status: EnrollmentStatus.ACTIVE,
      })
      .orderBy('student.studentCode', 'ASC')
      .getMany();
  }

  private findAttendancesForSession(sessionId: string): Promise<Attendance[]> {
    return this.attendancesRepository.find({
      where: { sessionId },
      relations: { markedBy: true },
    });
  }

  private async assertStudentsEnrolledInClass(
    organizationId: string,
    classId: string,
    studentIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(studentIds)];

    if (uniqueIds.length === 0) {
      return;
    }

    const enrollments = await this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .innerJoinAndSelect('enrollment.student', 'student')
      .where('enrollment.classId = :classId', { classId })
      .andWhere('enrollment.status = :status', {
        status: EnrollmentStatus.ACTIVE,
      })
      .andWhere('student.organizationId = :organizationId', {
        organizationId,
      })
      .andWhere('enrollment.studentId IN (:...studentIds)', {
        studentIds: uniqueIds,
      })
      .getMany();

    const enrolledIds = new Set(
      enrollments.map((enrollment) => enrollment.studentId),
    );

    for (const studentId of uniqueIds) {
      if (!enrolledIds.has(studentId)) {
        throw new BadRequestException(
          'Một hoặc nhiều học sinh không thuộc tổ chức này hoặc không được ghi danh vào lớp',
        );
      }
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    const err = error as {
      driverError?: { code?: string };
      code?: string;
    };
    const code = err.driverError?.code ?? err.code;
    return code === '23505';
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

  private toTeacherRef(
    teacher: Teacher | null | undefined,
  ): { id: string; name: string } | null {
    if (!teacher || !teacher.user?.fullName) {
      return null;
    }
    return { id: teacher.id, name: teacher.user.fullName };
  }

  async getSessionAttendance(
    userId: string,
    sessionId: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const session = await this.findSessionInOrganization(
      sessionId,
      organizationId,
    );

    const role = await this.resolveRoleKind(userId, organizationId);

    if (role === 'manager') {
      // Owners and admins have full access to attendance.
    } else if (role === 'teacher') {
      const teacher = await this.resolveTeacher(userId, organizationId);
      if (session.class.teacherId !== teacher.id) {
        throw new ForbiddenException('Giáo viên không dạy lớp này');
      }
    } else {
      throw new ForbiddenException('Bạn không có quyền truy cập điểm danh');
    }

    const enrollments = await this.findActiveEnrollmentsWithStudents(
      session.classId,
    );
    const attendances = await this.findAttendancesForSession(sessionId);
    const attendanceByStudent = new Map(
      attendances.map((attendance) => [attendance.studentId, attendance]),
    );

    return {
      role,
      session: {
        id: session.id,
        sessionDate: this.toDateString(session.sessionDate),
        startTime: this.toHmTime(session.startTime),
        endTime: this.toHmTime(session.endTime),
        status: session.status,
        type: session.type,
        room: session.room,
      },
      class: {
        id: session.class.id,
        name: session.class.name,
        code: session.class.code,
      },
      teacher: this.toTeacherRef(session.class.teacher),
      students: enrollments.map((enrollment) => {
        const student = enrollment.student;
        const attendance = attendanceByStudent.get(student.id);

        return {
          studentId: student.id,
          studentCode: student.studentCode,
          fullName: student.user?.fullName ?? null,
          attendance: attendance
            ? {
                id: attendance.id,
                status: attendance.status,
                note: attendance.note,
                markedAt: attendance.markedAt
                  ? attendance.markedAt.toISOString()
                  : null,
                markedBy: attendance.markedBy
                  ? {
                      id: attendance.markedBy.id,
                      name: attendance.markedBy.fullName,
                    }
                  : null,
              }
            : null,
        };
      }),
    };
  }

  async updateSessionAttendance(
    userId: string,
    sessionId: string,
    dto: UpdateAttendanceDto,
    options: OrgContextOptions = {},
  ): Promise<AttendanceUpdateSummary> {
    console.log(
      '[Attendance PUT] incoming userId=%s, sessionId=%s, org=%s',
      userId,
      sessionId,
      options.organizationId,
    );
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const session = await this.findSessionInOrganization(
      sessionId,
      organizationId,
    );

    if (session.status === ClassSessionStatus.CANCELLED) {
      throw new BadRequestException('Không thể điểm danh cho buổi học đã hủy');
    }

    const role = await this.resolveRoleKind(userId, organizationId);

    console.log(
      '[Attendance PUT] userId=%s, role=%s, sessionId=%s',
      userId,
      role,
      sessionId,
    );

    if (role === 'teacher') {
      const teacher = await this.resolveTeacher(userId, organizationId);
      if (session.class.teacherId !== teacher.id) {
        throw new ForbiddenException('Giáo viên không dạy lớp này');
      }
    } else if (role !== 'manager') {
      throw new ForbiddenException('Bạn không có quyền điểm danh');
    }

    const studentIds = dto.records.map((record) => record.studentId);

    await this.assertStudentsEnrolledInClass(
      organizationId,
      session.classId,
      studentIds,
    );

    const totalStudents = await this.enrollmentsRepository.countBy({
      classId: session.classId,
      status: EnrollmentStatus.ACTIVE,
    });

    await this.dataSource.transaction(async (manager) => {
      const attendanceRepo = manager.getRepository(Attendance);

      for (const record of dto.records) {
        const existing = await attendanceRepo.findOne({
          where: { sessionId, studentId: record.studentId },
        });

        if (existing) {
          existing.status = record.status;
          existing.note = record.note ?? null;
          existing.markedById = userId;
          existing.markedAt = new Date();
          await attendanceRepo.save(existing);
          continue;
        }

        try {
          const created = attendanceRepo.create({
            organizationId,
            sessionId,
            studentId: record.studentId,
            status: record.status,
            note: record.note ?? null,
            markedById: userId,
            markedAt: new Date(),
          });
          await attendanceRepo.save(created);
        } catch (error) {
          if (!this.isDuplicateKeyError(error)) {
            throw error;
          }

          // Concurrent creation raced us on UNIQUE(session_id, student_id).
          // Load the row committed by the other request and update it instead.
          const raced = await attendanceRepo.findOne({
            where: { sessionId, studentId: record.studentId },
          });

          if (!raced) {
            throw error;
          }

          raced.status = record.status;
          raced.note = record.note ?? null;
          raced.markedById = userId;
          raced.markedAt = new Date();
          await attendanceRepo.save(raced);
        }
      }
    });

    const attendances = await this.findAttendancesForSession(sessionId);

    const summary: AttendanceUpdateSummary = {
      sessionId,
      totalStudents,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    for (const attendance of attendances) {
      switch (attendance.status) {
        case AttendanceStatus.PRESENT:
          summary.present++;
          break;
        case AttendanceStatus.ABSENT:
          summary.absent++;
          break;
        case AttendanceStatus.LATE:
          summary.late++;
          break;
        case AttendanceStatus.EXCUSED:
          summary.excused++;
          break;
      }
    }

    return summary;
  }
}
