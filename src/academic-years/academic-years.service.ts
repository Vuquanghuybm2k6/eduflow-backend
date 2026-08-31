import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  AcademicYear,
  AcademicYearStatus,
} from './entities/academic-year.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly academicYearsRepository: Repository<AcademicYear>,
    @InjectRepository(Membership)
    private readonly membershipsRepository: Repository<Membership>,
    private readonly dataSource: DataSource,
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

  private assertDatesValid(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  private async assertNameAvailable(
    organizationId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.academicYearsRepository.findOneBy({
      organizationId,
      name,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'Academic year with this name already exists in the organization',
      );
    }
  }

  async create(
    userId: string,
    createAcademicYearDto: CreateAcademicYearDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const { name, startDate, endDate, status } = createAcademicYearDto;

    this.assertDatesValid(startDate, endDate);
    await this.assertNameAvailable(organizationId, name);

    const nextStatus = status ?? AcademicYearStatus.ACTIVE;

    return this.dataSource.transaction(async (manager) => {
      if (nextStatus === AcademicYearStatus.ACTIVE) {
        await manager
          .createQueryBuilder()
          .update(AcademicYear)
          .set({ status: AcademicYearStatus.COMPLETED })
          .where('organizationId = :organizationId', { organizationId })
          .andWhere('status = :status', { status: AcademicYearStatus.ACTIVE })
          .execute();
      }

      const academicYear = manager.create(AcademicYear, {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: nextStatus,
        organizationId,
      });

      return manager.save(academicYear);
    });
  }

  async findAll(userId: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.academicYearsRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const academicYear = await this.academicYearsRepository.findOneBy({
      id,
      organizationId,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return academicYear;
  }

  async update(
    userId: string,
    id: string,
    updateAcademicYearDto: UpdateAcademicYearDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const academicYear = await this.academicYearsRepository.findOneBy({
      id,
      organizationId,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    const { name, startDate, endDate } = updateAcademicYearDto;

    if (name !== undefined) {
      await this.assertNameAvailable(organizationId, name, id);
    }

    if (startDate !== undefined || endDate !== undefined) {
      this.assertDatesValid(
        startDate ?? academicYear.startDate.toISOString(),
        endDate ?? academicYear.endDate.toISOString(),
      );
    }

    Object.assign(academicYear, updateAcademicYearDto);

    return this.academicYearsRepository.save(academicYear);
  }

  async activate(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const academicYear = await this.academicYearsRepository.findOneBy({
      id,
      organizationId,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(AcademicYear)
        .set({ status: AcademicYearStatus.COMPLETED })
        .where('organizationId = :organizationId', { organizationId })
        .andWhere('status = :status', { status: AcademicYearStatus.ACTIVE })
        .execute();

      academicYear.status = AcademicYearStatus.ACTIVE;
      return manager.save(academicYear);
    });
  }

  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const academicYear = await this.academicYearsRepository.findOneBy({
      id,
      organizationId,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    if (academicYear.status === AcademicYearStatus.ACTIVE) {
      throw new ConflictException(
        'Cannot delete an academic year that is currently active',
      );
    }

    await this.academicYearsRepository.remove(academicYear);

    return { id };
  }
}
