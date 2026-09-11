import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ClassSessionStatus } from '../enums/class-session-status.enum';

export class SessionQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsEnum(ClassSessionStatus, {
    message: 'status phải thuộc SCHEDULED, COMPLETED, CANCELLED',
  })
  status?: ClassSessionStatus;
}
