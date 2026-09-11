import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';
import { Class } from '../../classes/entities/class.entity';
import { Schedule } from '../../schedules/entities/schedule.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { ClassSessionType } from '../enums/class-session-type.enum';
import { ClassSessionStatus } from '../enums/class-session-status.enum';

@Entity('class_sessions')
@Unique(['classId', 'sessionDate'])
export class ClassSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  classId!: string;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId!: string | null;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string;

  @Index()
  @Column({ name: 'session_date', type: 'date' })
  sessionDate!: Date;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'room', type: 'varchar', length: 100, nullable: true })
  room!: string | null;

  @Column({
    // buổi học này thuộc loại gì
    name: 'type',
    type: 'enum',
    enum: ClassSessionType,
    enumName: 'ClassSessionType',
    default: ClassSessionType.REGULAR,
  })
  type!: ClassSessionType;

  @Column({
    // hiện tại buổi học này đang thuộc trạng thái gì
    name: 'status',
    type: 'enum',
    enum: ClassSessionStatus,
    enumName: 'ClassSessionStatus',
    default: ClassSessionStatus.SCHEDULED,
  })
  status!: ClassSessionStatus;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({
    name: 'rescheduled_from_session_id',
    type: 'uuid',
    nullable: true,
  })
  rescheduledFromSessionId!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
  })
  updatedAt!: Date;

  // =========================
  // Relations
  // =========================

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Class, (classEntity) => classEntity.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  class!: Class;

  @ManyToOne(() => Schedule, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule!: Schedule | null;

  @ManyToOne(() => Teacher, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: Teacher | null;

  @ManyToOne(() => ClassSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rescheduled_from_session_id' })
  rescheduledFrom!: ClassSession | null;

  @OneToMany(() => ClassSession, (session) => session.rescheduledFrom)
  rescheduledTo!: ClassSession[];
}
