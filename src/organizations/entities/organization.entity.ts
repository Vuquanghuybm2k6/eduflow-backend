import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from '../../memberships/entities/membership.entity';
import { Role } from '../../roles/entities/role.entity';
import { Branch } from '../../branches/entities/branch.entity';

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    enumName: 'OrganizationStatus',
    default: OrganizationStatus.ACTIVE,
  })
  status!: OrganizationStatus;

  @OneToMany(() => Membership, (membership) => membership.organization)
  memberships!: Membership[];

  @OneToMany(() => Role, (role) => role.organization)
  roles!: Role[];

  @OneToMany(() => Branch, (branch) => branch.organization)
  branches!: Branch[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
