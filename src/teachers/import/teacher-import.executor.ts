import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import {
  Membership,
  MembershipStatus,
} from '../../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { Teacher, TeacherStatus } from '../entities/teacher.entity';
import { ImportJobRow } from '../../imports/entities/import-job-row.entity';

const TEACHER_ROLE_NAME = 'Teacher';

@Injectable()
export class TeacherImportExecutor {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
  ) {}

  async execute(row: ImportJobRow, organizationId: string): Promise<void> {
    const data = row.normalizedData;

    const email = this.readString(data['email']).toLowerCase();
    const fullName = this.readString(data['full_name']);
    const teacherCode = this.readString(data['teacher_code']);
    const specialization = this.readOptionalString(data['specialization']);
    const qualification = this.readOptionalString(data['qualification']);
    const bio = this.readOptionalString(data['bio']);
    const hireDate = this.readOptionalString(data['hire_date']);
    const branchCodes = this.readBranchCodes(data['branch_codes']);

    await this.validateRowDb(organizationId, teacherCode, email, branchCodes);

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.dataSource.transaction(async (txManager) => {
      const branches = await this.resolveBranches(
        txManager,
        organizationId,
        branchCodes,
      );

      const user = await txManager.save(
        txManager.create(User, {
          email,
          passwordHash,
          fullName,
          phone: null,
        }),
      );

      const role = await this.findOrCreateTeacherRole(
        txManager,
        organizationId,
      );

      await txManager.save(
        txManager.create(Membership, {
          userId: user.id,
          organizationId,
          roleId: role.id,
          status: MembershipStatus.ACTIVE,
        }),
      );

      await txManager.save(
        txManager.create(Teacher, {
          userId: user.id,
          organizationId,
          teacherCode,
          specialization: specialization || null,
          qualification: qualification || null,
          bio: bio || null,
          hireDate: hireDate ? new Date(hireDate) : null,
          status: TeacherStatus.ACTIVE,
          branches,
        }),
      );
    });
  }

  private async validateRowDb(
    organizationId: string,
    teacherCode: string,
    email: string,
    branchCodes: string[],
  ): Promise<void> {
    const existingTeacher = await this.teachersRepository.findOne({
      where: { organizationId, teacherCode },
    });

    if (existingTeacher) {
      throw new ConflictException(
        `Teacher code "${teacherCode}" already exists`,
      );
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(`Email "${email}" already exists`);
    }

    if (branchCodes.length > 0) {
      const branches = await this.branchesRepository.find({
        where: { organizationId, code: In(branchCodes) },
      });

      const branchMap = new Map(branches.map((b) => [b.code, b]));

      for (const code of branchCodes) {
        const branch = branchMap.get(code);

        if (!branch) {
          throw new ConflictException(
            `Branch "${code}" not found in organization`,
          );
        }

        if (branch.status !== BranchStatus.ACTIVE) {
          throw new ConflictException(`Branch "${code}" is inactive`);
        }
      }
    }
  }

  private async resolveBranches(
    manager: EntityManager,
    organizationId: string,
    branchCodes: string[],
  ): Promise<Branch[]> {
    if (branchCodes.length === 0) {
      throw new ConflictException('At least one branch is required');
    }

    const branches = await manager.findBy(Branch, {
      organizationId,
      code: In(branchCodes),
    });

    if (branches.length !== branchCodes.length) {
      throw new ConflictException('One or more branches not found');
    }

    if (branches.some((b) => b.status !== BranchStatus.ACTIVE)) {
      throw new ConflictException('One or more branches are inactive');
    }

    return branches;
  }

  private async findOrCreateTeacherRole(
    manager: EntityManager,
    organizationId: string,
  ): Promise<Role> {
    const existing = await manager.findOneBy(Role, {
      organizationId,
      name: TEACHER_ROLE_NAME,
    });

    if (existing) {
      return existing;
    }

    return manager.save(
      manager.create(Role, {
        name: TEACHER_ROLE_NAME,
        organizationId,
        isSystem: true,
      }),
    );
  }

  private readBranchCodes(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => this.readString(item))
        .filter((item) => item !== '');
    }

    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
    }

    return [];
  }

  private readString(raw: unknown): string {
    if (typeof raw === 'string') {
      return raw.trim();
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw).trim();
    }

    return '';
  }

  private readOptionalString(raw: unknown): string | null {
    if (typeof raw === 'string') {
      return raw.trim() || null;
    }

    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw).trim();
    }

    return null;
  }

  private generateTemporaryPassword(): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = randomBytes(12);
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset[bytes[i] % charset.length];
    }
    return 'EduFlow!' + password;
  }
}
