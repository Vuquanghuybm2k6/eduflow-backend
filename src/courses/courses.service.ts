import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

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

  async create(createCourseDto: CreateCourseDto, organizationId: string) {
    await this.assertCodeAvailable(organizationId, createCourseDto.code);

    const course = this.coursesRepository.create({
      ...createCourseDto,
      description: createCourseDto.description ?? null,
      duration: createCourseDto.duration ?? null,
      organizationId,
    });

    return this.coursesRepository.save(course);
  }

  async findAll(organizationId: string) {
    return this.coursesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId: string) {
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
    id: string,
    updateCourseDto: UpdateCourseDto,
    organizationId: string,
  ) {
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

  async remove(id: string, organizationId: string) {
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
