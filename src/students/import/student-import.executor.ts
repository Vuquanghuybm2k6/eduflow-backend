import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { Student, StudentGender } from '../entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { ImportJobRow } from '../../imports/entities/import-job-row.entity';

const STUDENT_ROLE_NAME = 'Student';

@Injectable()
export class StudentImportExecutor {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async execute(
    row: ImportJobRow,
    organizationId: string,
  ): Promise<void> {
    const data = row.normalizedData;

    const studentCode = String(data['student_code'] || '').trim();
    const email = String(data['email'] || '').trim().toLowerCase();
    const fullName = String(data['full_name'] || '').trim();
    const phone = data['phone'] ? String(data['phone']).trim() : null;
    const dateOfBirth = data['date_of_birth']
      ? String(data['date_of_birth']).trim()
      : null;
    const gender = data['gender'] ? String(data['gender']).trim() : null;
    const branchCode = String(data['branch_code'] || '').trim();

    const genderEnum = this.resolveGender(gender);

    await this.validateRowDb(
      organizationId,
      studentCode,
      email,
      branchCode,
    );

    const branch = await this.branchesRepository.findOne({
      where: { organizationId, code: branchCode, status: BranchStatus.ACTIVE },
    });

    if (!branch) {
      throw new ConflictException('Branch not found or inactive');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await this.dataSource.transaction(async (txManager) => {
      const user = await txManager.save(
        txManager.create(User, {
          email,
          passwordHash,
          fullName,
          phone,
        }),
      );

      const role = await this.findOrCreateStudentRole(
        txManager,
        organizationId,
      );

      await txManager.save(
        txManager.create(Membership, {
          userId: user.id,
          organizationId,
          roleId: role.id,
        }),
      );

      await txManager.save(
        txManager.create(Student, {
          userId: user.id,
          organizationId,
          studentCode,
          dateOfBirth: dateOfBirth || null,
          gender: genderEnum,
          branches: [branch],
        }),
      );
    });
  }

  private async validateRowDb(
    organizationId: string,
    studentCode: string,
    email: string,
    branchCode: string,
  ): Promise<void> {
    const branch = await this.branchesRepository.findOne({
      where: { organizationId, code: branchCode },
    });

    if (!branch) {
      throw new ConflictException(`Branch "${branchCode}" not found`);
    }

    if (branch.status !== BranchStatus.ACTIVE) {
      throw new ConflictException(`Branch "${branchCode}" is inactive`);
    }

    const existingStudent = await this.studentsRepository.findOne({
      where: { organizationId, studentCode },
    });

    if (existingStudent) {
      throw new ConflictException(
        `Student code "${studentCode}" already exists`,
      );
    }

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(`Email "${email}" already exists`);
    }
  }

  private async findOrCreateStudentRole(
    manager: EntityManager,
    organizationId: string,
  ): Promise<Role> {
    const existing = await manager.findOneBy(Role, {
      organizationId,
      name: STUDENT_ROLE_NAME,
    });

    if (existing) {
      return existing;
    }

    return manager.save(
      manager.create(Role, {
        name: STUDENT_ROLE_NAME,
        organizationId,
        isSystem: true,
      }),
    );
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

  private resolveGender(gender: string | null): StudentGender | null {
    const knownGenders = Object.values(StudentGender) as string[];
    return gender && knownGenders.includes(gender)
      ? (gender as StudentGender)
      : null;
  }
}