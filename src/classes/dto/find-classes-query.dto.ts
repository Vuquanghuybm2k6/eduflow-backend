import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ClassLifecycleStatus, ClassStatus } from '../entities/class.entity';

export class FindClassesQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @IsOptional()
  @IsEnum(ClassLifecycleStatus)
  lifecycleStatus?: ClassLifecycleStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
