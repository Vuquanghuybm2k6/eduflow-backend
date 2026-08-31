import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from '../../organizations/entities/organization.entity';

export enum BranchStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('branches')
export class Branch {
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
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({
    type: 'enum',
    enum: BranchStatus,
    enumName: 'BranchStatus',
    default: BranchStatus.ACTIVE,
  })
  status!: BranchStatus;

  @ManyToOne(() => Organization, (organization) => organization.branches, {
    onDelete: 'CASCADE',
  })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
