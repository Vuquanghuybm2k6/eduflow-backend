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
import { Membership } from '../../memberships/entities/membership.entity';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
@Unique(['organizationId', 'name'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ nullable: true })
  organizationId!: string | null;

  @Column({ default: false })
  isSystem!: boolean;

  @ManyToOne(() => Organization, (organization) => organization.roles, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization | null;

  @OneToMany(() => Membership, (membership) => membership.role)
  memberships!: Membership[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
