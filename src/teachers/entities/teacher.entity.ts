import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Class } from '../../classes/entities/class.entity';
import { Branch } from '../../branches/entities/branch.entity';

export enum TeacherStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('teachers')
@Unique(['userId'])
@Unique(['organizationId', 'teacherCode'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  teacherCode!: string;

  @Column({ type: 'text', nullable: true })
  specialization!: string | null;

  @Column({ type: 'text', nullable: true })
  qualification!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'date', nullable: true })
  hireDate!: Date | null;

  @Column({
    type: 'enum',
    enum: TeacherStatus,
    enumName: 'TeacherStatus',
    default: TeacherStatus.ACTIVE,
  })
  status!: TeacherStatus;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Organization, (organization) => organization.teachers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @OneToMany(() => Class, (classEntity) => classEntity.teacher)
  classes!: Class[];

  @ManyToMany(() => Branch, (branch) => branch.teachers)
  @JoinTable({
    name: 'teacher_branches',
    joinColumn: { name: 'teacherId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'branchId', referencedColumnName: 'id' },
  })
  branches!: Branch[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
