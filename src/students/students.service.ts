import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import { Branch, BranchStatus } from '../branches/entities/branch.entity';
import { RoleCode } from '../authorization/enums/role.enum';

@Injectable()
export class StudentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  async assertIsAdminOrOwner(userId: string, organizationId: string) {
    const membership = await this.membershipsRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { role: true },
    });

    if (!membership || !membership.role) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    const roleName = membership.role.name.toLowerCase();
    const isManager = roleName.includes('owner') || roleName.includes('admin');

    if (!isManager) {
      throw new ForbiddenException(
        'Only an owner or admin can perform this action',
      );
    }
  }

  private async findStudentRole(manager: EntityManager): Promise<Role> {
    const role = await manager.findOneBy(Role, { code: RoleCode.STUDENT });
    if (!role) {
      throw new InternalServerErrorException(
        'System role STUDENT is not seeded. Run `npm run seed`',
      );
    }

    return role;
  }

  private async assertStudentCodeAvailable(
    organizationId: string,
    studentCode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.studentsRepository.findOneBy({
      organizationId,
      studentCode,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mã học viên này đã tồn tại');
    }
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.usersRepository.findOneBy({ email });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }
  }

  private async resolveBranches(
    manager: EntityManager,
    organizationId: string,
    branchIds: string[],
  ): Promise<Branch[]> {
    const uniqueIds = [...new Set(branchIds)];
    const branches = await manager.findBy(Branch, {
      organizationId,
      id: In(uniqueIds),
    });

    if (branches.length !== uniqueIds.length) {
      throw new NotFoundException('Một hoặc nhiều chi nhánh không tồn tại');
    }

    if (branches.some((b) => b.status !== BranchStatus.ACTIVE)) {
      throw new ConflictException(
        'Một hoặc nhiều chi nhánh hiện đang ngừng hoạt động',
      );
    }

    return branches;
  }

  private async findStudentOrThrow(id: string, organizationId: string) {
    const student = await this.studentsRepository.findOne({
      where: { id, organizationId },
      relations: { user: true, branches: true },
    });

    if (!student) {
      throw new NotFoundException('Học viên không tồn tại');
    }

    return student;
  }

  async create(
    actorUserId: string,
    createStudentDto: CreateStudentDto,
    organizationId: string,
  ) {
    await this.assertIsAdminOrOwner(actorUserId, organizationId);
    await this.assertStudentCodeAvailable(
      organizationId,
      createStudentDto.studentCode,
    );
    await this.assertEmailAvailable(createStudentDto.email);

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const student = await this.dataSource.transaction(async (manager) => {
      const branches = await this.resolveBranches(
        manager,
        organizationId,
        createStudentDto.branchIds,
      );

      const user = await manager.save(
        manager.create(User, {
          email: createStudentDto.email,
          passwordHash,
          fullName: createStudentDto.fullName,
          phone: createStudentDto.phone ?? null,
          gender: createStudentDto.gender ?? null,
        }),
      );

      const role = await this.findStudentRole(manager);

      await manager.save(
        manager.create(Membership, {
          userId: user.id,
          organizationId,
          roleId: role.id,
        }),
      );

      return manager.save(
        manager.create(Student, {
          userId: user.id,
          organizationId,
          studentCode: createStudentDto.studentCode,
          dateOfBirth: createStudentDto.dateOfBirth ?? null,
          address: createStudentDto.address ?? null,
          branches,
        }),
      );
    });

    return {
      student,
      temporaryPassword,
    };
  }

  async findAll(
    actorUserId: string,
    organizationId: string,
  ): Promise<Student[]> {
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    return this.studentsRepository.find({
      where: { organizationId },
      relations: { user: true, branches: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(actorUserId: string, id: string, organizationId: string) {
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    return this.findStudentOrThrow(id, organizationId);
  }

  async findMe(userId: string, organizationId: string): Promise<Student> {
    const student = await this.studentsRepository.findOne({
      where: { userId, organizationId },
      relations: { user: true, branches: true },
    });

    if (!student) {
      throw new NotFoundException(
        'Hồ sơ học viên không tồn tại cho tài khoản này',
      );
    }

    return student;
  }

  async update(
    actorUserId: string,
    id: string,
    updateStudentDto: UpdateStudentDto,
    organizationId: string,
  ) {
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    const student = await this.findStudentOrThrow(id, organizationId);

    if (
      updateStudentDto.studentCode !== undefined &&
      updateStudentDto.studentCode !== student.studentCode
    ) {
      await this.assertStudentCodeAvailable(
        organizationId,
        updateStudentDto.studentCode,
        id,
      );
    }

    if (updateStudentDto.branchIds) {
      const branches = await this.dataSource.transaction((manager) =>
        this.resolveBranches(
          manager,
          organizationId,
          updateStudentDto.branchIds!,
        ),
      );
      student.branches = branches;
    }

    const { branchIds: _branchIds, gender, ...fields } = updateStudentDto;
    Object.assign(student, fields);

    if (gender !== undefined && student.user) {
      student.user.gender = gender ?? null;
    }

    await this.studentsRepository.save(student);
    if (gender !== undefined && student.user) {
      await this.usersRepository.save(student.user);
    }
    return student;
  }

  async updateProfile(
    userId: string,
    updateStudentDto: UpdateStudentDto,
    organizationId: string,
  ) {
    const student = await this.studentsRepository.findOne({
      where: { userId, organizationId },
      relations: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Hồ sơ học viên không tồn tại');
    }

    const { branchIds, studentCode, ...profileFields } = updateStudentDto;
    Object.assign(student, profileFields);

    if (updateStudentDto.gender !== undefined && student.user) {
      student.user.gender = updateStudentDto.gender ?? null;
    }

    await this.studentsRepository.save(student);
    if (updateStudentDto.gender !== undefined && student.user) {
      await this.usersRepository.save(student.user);
    }
    return student;
  }

  async updateStatus(
    actorUserId: string,
    id: string,
    updateStudentStatusDto: UpdateStudentStatusDto,
    organizationId: string,
  ) {
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    const student = await this.findStudentOrThrow(id, organizationId);
    student.status = updateStudentStatusDto.status;

    return this.studentsRepository.save(student);
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
