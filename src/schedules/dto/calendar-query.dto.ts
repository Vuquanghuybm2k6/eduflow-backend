import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CalendarQueryDto {
  @IsDateString({}, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  startDate!: string;

  @IsDateString({}, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  endDate!: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'teacherId phải là UUID hợp lệ' })
  teacherId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'branchId phải là UUID hợp lệ' })
  branchId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'classId phải là UUID hợp lệ' })
  classId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'courseId phải là UUID hợp lệ' })
  courseId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'organizationId phải là UUID hợp lệ' })
  organizationId?: string;
}
