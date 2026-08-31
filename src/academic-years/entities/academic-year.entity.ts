import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';

export enum AcademicYearStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
}

@Entity('academic_years')
@Unique(['organizationId', 'name'])
export class AcademicYear {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date' })
  endDate!: Date;

  @Column({
    type: 'enum',
    enum: AcademicYearStatus,
    enumName: 'AcademicYearStatus',
    default: AcademicYearStatus.ACTIVE,
  })
  status!: AcademicYearStatus;

  @ManyToOne(() => Organization, (organization) => organization.academicYears, {
    onDelete: 'CASCADE',
  })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
