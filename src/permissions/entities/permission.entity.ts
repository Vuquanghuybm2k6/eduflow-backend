import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RolePermission } from '../../roles/entities/role-permission.entity';
import { Permission as PermissionCode } from '../../authorization/enums/permission.enum';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true, where: '"code" IS NOT NULL' })
  @Column({ type: 'text', nullable: true })
  code!: PermissionCode | null;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermission[];

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 3 })
  updatedAt!: Date;
}
