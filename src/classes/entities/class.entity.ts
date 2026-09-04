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
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('classes')
@Unique(['organizationId', 'code'])
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Index()
  @Column({ type: 'uuid' })
  branchId!: string;

  @Index()
  @Column({ type: 'uuid' })
  courseId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  teacherId!: string | null;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date' })
  endDate!: Date;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({
    type: 'enum',
    enum: ClassStatus,
    enumName: 'ClassStatus',
    default: ClassStatus.UPCOMING,
  })
  status!: ClassStatus;

  @ManyToOne(() => Organization, (organization) => organization.classes, {
    onDelete: 'CASCADE',
  })
  organization!: Organization;

  @ManyToOne(() => Branch, (branch) => branch.classes, {
    onDelete: 'CASCADE',
  })
  branch!: Branch;

  @ManyToOne(() => Course, (course) => course.classes, {
    onDelete: 'CASCADE',
  })
  course!: Course;

  @ManyToOne(() => Teacher, (teacher) => teacher.classes, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'teacherId' })
  teacher!: Teacher | null;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.class)
  enrollments!: Enrollment[];

  @OneToMany(() => Schedule, (schedule) => schedule.class)
  schedules!: Schedule[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
