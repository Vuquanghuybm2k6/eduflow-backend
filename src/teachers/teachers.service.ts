import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { Teacher } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateTeacherStatusDto } from './dto/update-teacher-status.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import { Class } from '../classes/entities/class.entity';
import { Branch } from '../branches/entities/branch.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

const TEACHER_ROLE_NAME = 'Teacher';

@Injectable()
export class TeachersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Teacher)
    private readonly teachersRepository: Repository<Teacher>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
  ) {}

  private async resolveOrganizationId(
    userId: string,
    requestedOrganizationId?: string,
  ): Promise<string> {
    const qb = this.membershipsRepository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.organization', 'organization')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.ACTIVE,
      });

    if (requestedOrganizationId) {
      qb.andWhere('membership.organizationId = :organizationId', {
        organizationId: requestedOrganizationId,
      });
    }

    qb.orderBy('membership.joinedAt', 'ASC')
      .addOrderBy('membership.createdAt', 'ASC')
      .limit(1);

    const membership = await qb.getOne();

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to this organization',
      );
    }

    return membership.organizationId;
  }

  private async assertIsAdminOrOwner(userId: string, organizationId: string) {
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
    const isManager =
      roleName.includes('owner') || roleName.includes('admin');

    if (!isManager) {
      throw new ForbiddenException(
        'Only an owner or admin can perform this action',
      );
    }
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

  private async assertTeacherCodeAvailable(
    organizationId: string,
    teacherCode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.teachersRepository.findOneBy({
      organizationId,
      teacherCode,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mã giáo viên này đã tồn tại');
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

    return branches;
  }

  private async findTeacherOrThrow(id: string, organizationId: string) {
    const teacher = await this.teachersRepository.findOne({
      where: { id, organizationId },
      relations: { user: true, branches: true },
    });

    if (!teacher) {
      throw new NotFoundException('Giáo viên không tồn tại');
    }

    return teacher;
  }

  /**
   * Owner/Admin creates the Teacher: this creates the User, the TEACHER
   * Membership and the Teacher profile inside a single transaction so that a
   * failure on any step rolls everything back.
   */
  async create(
    actorUserId: string,
    createTeacherDto: CreateTeacherDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      actorUserId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(actorUserId, organizationId);
    await this.assertTeacherCodeAvailable(
      organizationId,
      createTeacherDto.teacherCode,
    );
    await this.assertEmailAvailable(createTeacherDto.email);

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const teacher = await this.dataSource.transaction(async (manager) => {
      const branches = await this.resolveBranches(
        manager,
        organizationId,
        createTeacherDto.branchIds,
      );

      const user = await manager.save(
        manager.create(User, {
          email: createTeacherDto.email,
          passwordHash,
          fullName: createTeacherDto.fullName,
          phone: createTeacherDto.phone ?? null,
        }),
      );

      const role = await this.findOrCreateTeacherRole(manager, organizationId);

      await manager.save(
        manager.create(Membership, {
          userId: user.id,
          organizationId,
          roleId: role.id,
        }),
      );

      return manager.save(
        manager.create(Teacher, {
          userId: user.id,
          organizationId,
          teacherCode: createTeacherDto.teacherCode,
          specialization: createTeacherDto.specialization ?? null,
          qualification: createTeacherDto.qualification ?? null,
          bio: createTeacherDto.bio ?? null,
          hireDate: createTeacherDto.hireDate ?? null,
          branches,
        }),
      );
    });

    return {
      teacher,
      temporaryPassword,
    };
  }

  async findAll(
    actorUserId: string,
    options: OrgContextOptions = {},
  ): Promise<Teacher[]> {
    const organizationId = await this.resolveOrganizationId(
      actorUserId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    return this.teachersRepository.find({
      where: { organizationId },
      relations: { user: true, branches: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    actorUserId: string,
    id: string,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      actorUserId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    return this.findTeacherOrThrow(id, organizationId);
  }

  async findMe(
    userId: string,
    options: OrgContextOptions = {},
  ): Promise<Teacher> {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const teacher = await this.teachersRepository.findOne({
      where: { userId, organizationId },
      relations: { user: true, branches: true },
    });

    if (!teacher) {
      throw new NotFoundException(
        'Hồ sơ giáo viên không tồn tại cho tài khoản này',
      );
    }

    return teacher;
  }

  async findMyClasses(
    userId: string,
    options: OrgContextOptions = {},
  ): Promise<Class[]> {
    const teacher = await this.findMe(userId, options);

    return this.classesRepository.find({
      where: { teacherId: teacher.id },
      order: { startDate: 'ASC' },
    });
  }

  async update(
    actorUserId: string,
    id: string,
    updateTeacherDto: UpdateTeacherDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      actorUserId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    const teacher = await this.findTeacherOrThrow(id, organizationId);

    if (
      updateTeacherDto.teacherCode !== undefined &&
      updateTeacherDto.teacherCode !== teacher.teacherCode
    ) {
      await this.assertTeacherCodeAvailable(
        organizationId,
        updateTeacherDto.teacherCode,
        id,
      );
    }

    if (updateTeacherDto.branchIds) {
      const branches = await this.dataSource.transaction((manager) =>
        this.resolveBranches(manager, organizationId, updateTeacherDto.branchIds!),
      );
      teacher.branches = branches;
    }

    const { branchIds: _branchIds, ...fields } = updateTeacherDto;
    Object.assign(teacher, fields);
    return this.teachersRepository.save(teacher);
  }

  async updateStatus(
    actorUserId: string,
    id: string,
    updateTeacherStatusDto: UpdateTeacherStatusDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      actorUserId,
      options.organizationId,
    );
    await this.assertIsAdminOrOwner(actorUserId, organizationId);

    const teacher = await this.findTeacherOrThrow(id, organizationId);
    teacher.status = updateTeacherStatusDto.status;

    return this.teachersRepository.save(teacher);
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