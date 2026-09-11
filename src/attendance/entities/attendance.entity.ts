import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';
import { ClassSession } from '../../sessions/entities/class-session.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { AttendanceStatus } from '../enums/attendance-status.enum';

@Entity('attendances')
@Unique(['sessionId', 'studentId'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Index()
  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'AttendanceStatus',
  })
  status!: AttendanceStatus;

  @Column({ name: 'note', type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz', nullable: true })
  markedAt!: Date | null;

  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  markedById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', precision: 3 })
  updatedAt!: Date;

  // =========================
  // Relations
  // =========================

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => ClassSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: ClassSession;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'marked_by' })
  markedBy!: User | null;
}
