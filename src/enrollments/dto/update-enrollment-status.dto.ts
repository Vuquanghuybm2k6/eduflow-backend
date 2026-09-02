import { IsEnum, IsNotEmpty } from 'class-validator';
import { EnrollmentStatus } from '../entities/enrollment.entity';

export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  @IsNotEmpty()
  status!: EnrollmentStatus;
}
