import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course } from './entities/course.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { MembershipStatus } from '../memberships/entities/membership.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

export interface OrgContextOptions {
  organizationId?: string;
}

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
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

  private async assertCodeAvailable(
    organizationId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.coursesRepository.findOneBy({
      organizationId,
      code,
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mã code này đã tồn tại');
    }
  }

  async create(
    userId: string,
    createCourseDto: CreateCourseDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    await this.assertCodeAvailable(organizationId, createCourseDto.code);

    const course = this.coursesRepository.create({
      ...createCourseDto,
      description: createCourseDto.description ?? null,
      duration: createCourseDto.duration ?? null,
      organizationId,
    });

    return this.coursesRepository.save(course);
  }

  async findAll(userId: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    return this.coursesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const course = await this.coursesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async update(
    userId: string,
    id: string,
    updateCourseDto: UpdateCourseDto,
    options: OrgContextOptions = {},
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const course = await this.coursesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (updateCourseDto.code !== undefined) {
      await this.assertCodeAvailable(organizationId, updateCourseDto.code, id);
    }

    Object.assign(course, updateCourseDto);

    return this.coursesRepository.save(course);
  }

  async remove(userId: string, id: string, options: OrgContextOptions = {}) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      options.organizationId,
    );

    const course = await this.coursesRepository.findOneBy({
      id,
      organizationId,
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    await this.coursesRepository.remove(course);

    return { id };
  }
}
