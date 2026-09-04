import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Branch, BranchStatus } from './entities/branch.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Class, ClassStatus } from '../classes/entities/class.entity';

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
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

  private async assertBranchCodeAvailable(
    organizationId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.branchesRepository.findOneBy({
      organizationId,
      code,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mã chi nhánh này đã tồn tại');
    }
  }

  async create(
    userId: string,
    createBranchDto: CreateBranchDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    await this.assertBranchCodeAvailable(organizationId, createBranchDto.code);

    const branch = this.branchesRepository.create({
      ...createBranchDto,
      organizationId,
    });

    return this.branchesRepository.save(branch);
  }

  async findAll(userId: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.branchesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const branch = await this.branchesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    return branch;
  }

  async update(
    userId: string,
    id: string,
    updateBranchDto: UpdateBranchDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const branch = await this.branchesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    if (
      updateBranchDto.code !== undefined &&
      updateBranchDto.code !== branch.code
    ) {
      await this.assertBranchCodeAvailable(organizationId, updateBranchDto.code, id);
    }

    Object.assign(branch, updateBranchDto);

    return this.branchesRepository.save(branch);
  }

  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const branch = await this.branchesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!branch) {
      throw new NotFoundException('Chi nhánh không tồn tại');
    }

    const activeClassCount = await this.classesRepository
      .createQueryBuilder('class')
      .where('class.branchId = :branchId', { branchId: id })
      .andWhere('class.status != :cancelled', {
        cancelled: ClassStatus.CANCELLED,
      })
      .andWhere('class.endDate >= CURRENT_DATE')
      .getCount();

    if (activeClassCount > 0) {
      throw new ConflictException(
        'Chi nhánh đang có lớp học sắp diễn ra hoặc đang hoạt động, không thể vô hiệu hóa',
      );
    }

    branch.status = BranchStatus.INACTIVE;
    await this.branchesRepository.save(branch);

    return { id, status: BranchStatus.INACTIVE };
  }
}
