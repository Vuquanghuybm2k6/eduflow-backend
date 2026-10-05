import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Branch, BranchStatus } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Class, ClassLifecycleStatus } from '../classes/entities/class.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Class)
    private readonly classesRepository: Repository<Class>,
  ) {}

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

  async create(createBranchDto: CreateBranchDto, organizationId: string) {
    await this.assertBranchCodeAvailable(organizationId, createBranchDto.code);

    const branch = this.branchesRepository.create({
      ...createBranchDto,
      organizationId,
    });

    return this.branchesRepository.save(branch);
  }

  async findAll(organizationId: string) {
    return this.branchesRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId: string) {
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
    id: string,
    updateBranchDto: UpdateBranchDto,
    organizationId: string,
  ) {
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
      await this.assertBranchCodeAvailable(
        organizationId,
        updateBranchDto.code,
        id,
      );
    }

    Object.assign(branch, updateBranchDto);

    return this.branchesRepository.save(branch);
  }

  async remove(id: string, organizationId: string) {
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
      .andWhere('class.lifecycleStatus != :cancelled', {
        cancelled: ClassLifecycleStatus.CANCELLED,
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
