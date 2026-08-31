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
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Role } from '../../roles/entities/role.entity';

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('memberships')
@Unique(['userId', 'organizationId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Index()
  @Column()
  organizationId!: string;

  @Column()
  roleId!: string;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    enumName: 'MembershipStatus',
    default: MembershipStatus.ACTIVE,
  })
  status!: MembershipStatus;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Organization, (organization) => organization.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @ManyToOne(() => Role, (role) => role.memberships)
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @Column({
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt!: Date;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
