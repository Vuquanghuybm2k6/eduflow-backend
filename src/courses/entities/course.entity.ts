import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';
import { Class } from '../../classes/entities/class.entity';

export enum CourseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('courses')
@Unique(['organizationId', 'code'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int', nullable: true })
  duration!: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  tuitionFee!: number | null;

  @Column({
    type: 'enum',
    enum: CourseStatus,
    enumName: 'CourseStatus',
    default: CourseStatus.ACTIVE,
  })
  status!: CourseStatus;

  @ManyToOne(() => Organization, (organization) => organization.courses, {
    onDelete: 'CASCADE',
  })
  organization!: Organization;

  @OneToMany(() => Class, (classEntity) => classEntity.course)
  classes!: Class[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
