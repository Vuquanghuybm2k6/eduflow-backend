import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { Student } from '../entities/student.entity';
import { Gender, User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Membership } from '../../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../../branches/entities/branch.entity';
import { ImportJobRow } from '../../imports/entities/import-job-row.entity';
import {
  readCellString,
  readOptionalCellString,
} from '../../imports/utils/cell-value.utils';
import { RoleCode } from '../../authorization/enums/role.enum';

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

  async execute(row: ImportJobRow, organizationId: string): Promise<void> {
    const data = row.normalizedData;

    const studentCode = readCellString(data['student_code']);
    const email = readCellString(data['email']).toLowerCase();
    const fullName = readCellString(data['full_name']);
    const phone = readOptionalCellString(data['phone']);
    const dateOfBirth = readOptionalCellString(data['date_of_birth']);
    const gender = readOptionalCellString(data['gender']);
    const branchCode = readCellString(data['branch_code']);

    const genderEnum = this.resolveGender(gender);

    await this.validateRowDb(organizationId, studentCode, email, branchCode);

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
          gender: genderEnum,
        }),
      );

      const role = await this.findStudentRole(txManager);

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

  private async findStudentRole(manager: EntityManager): Promise<Role> {
    const role = await manager.findOneBy(Role, { code: RoleCode.STUDENT });
    if (!role) {
      throw new ConflictException(
        'System role STUDENT is not seeded. Run `npm run seed`',
      );
    }

    return role;
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

  private resolveGender(gender: string | null): Gender | null {
    const knownGenders = Object.values(Gender) as string[];
    return gender && knownGenders.includes(gender) ? (gender as Gender) : null;
  }
}
