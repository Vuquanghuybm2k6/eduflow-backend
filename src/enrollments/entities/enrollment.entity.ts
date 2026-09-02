import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Student } from '../../students/entities/student.entity';
import { Class } from '../../classes/entities/class.entity';

export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('enrollments')
@Unique(['studentId', 'classId'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'student_id',
    type: 'uuid',
  })
  studentId!: string;

  @Column({
    name: 'class_id',
    type: 'uuid',
  })
  classId!: string;

  @Column({
    name: 'enrolled_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  enrolledAt!: Date;

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  status!: EnrollmentStatus;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @ManyToOne(() => Student, (student) => student.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'student_id',
  })
  student!: Student;

  @ManyToOne(() => Class, (classEntity) => classEntity.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'class_id',
  })
  class!: Class;
}
