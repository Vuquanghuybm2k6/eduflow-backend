import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Branch } from './entities/branch.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

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

  async create(
    userId: string,
    createBranchDto: CreateBranchDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

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
      throw new NotFoundException('Branch not found');
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
      throw new NotFoundException('Branch not found');
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
      throw new NotFoundException('Branch not found');
    }

    await this.branchesRepository.remove(branch);

    return { id };
  }
}
