import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from '../../permissions/entities/permission.entity';

@Entity('role_permissions')
@Unique(['roleId', 'permissionId'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  roleId!: string;

  @Index()
  @Column()
  permissionId!: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission!: Permission;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
