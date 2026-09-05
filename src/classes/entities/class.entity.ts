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
import { Branch } from '../../branches/entities/branch.entity';
import { Course } from '../../courses/entities/course.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';
import { Enrollment } from '../../enrollments/entities/enrollment.entity';
import { Schedule } from '../../schedules/entities/schedule.entity';

export enum ClassStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ClassLifecycleStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('classes')
@Unique(['organizationId', 'code'])
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Index()
  @Column({ name: 'branch_id', type: 'uuid' })
  branchId!: string;

  @Index()
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId!: string | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: Date;

  @Column({ name: 'capacity', type: 'int' })
  capacity!: number;

  /**
   * Record status:
   * ACTIVE   -> Class đang được sử dụng
   * INACTIVE -> Class không còn hoạt động trong hệ thống
   */
  @Column({
    name: 'status',
    type: 'enum',
    enum: ClassStatus,
    enumName: 'ClassStatus',
    default: ClassStatus.ACTIVE,
  })
  status!: ClassStatus;

  /**
   * Lifecycle status:
   * UPCOMING  -> Chưa bắt đầu
   * ONGOING   -> Đang diễn ra
   * COMPLETED -> Đã hoàn thành
   * CANCELLED -> Đã bị hủy
   */
  @Column({
    name: 'lifecycle_status',
    type: 'enum',
    enum: ClassLifecycleStatus,
    enumName: 'ClassLifecycleStatus',
    default: ClassLifecycleStatus.UPCOMING,
  })
  lifecycleStatus!: ClassLifecycleStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', precision: 3 })
  updatedAt!: Date;

  // =========================
  // Relations
  // =========================

  @ManyToOne(() => Organization, (organization) => organization.classes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Branch, (branch) => branch.classes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @ManyToOne(() => Course, (course) => course.classes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @ManyToOne(() => Teacher, (teacher) => teacher.classes, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: Teacher | null;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.class)
  enrollments!: Enrollment[];

  @OneToMany(() => Schedule, (schedule) => schedule.class)
  schedules!: Schedule[];
}
