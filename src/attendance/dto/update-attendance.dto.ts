import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { AttendanceStatus } from '../enums/attendance-status.enum';

export class UpdateAttendanceRecordDto {
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @IsEnum(AttendanceStatus, {
    message: 'status phải thuộc PRESENT, ABSENT, LATE, EXCUSED',
  })
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'note không được vượt quá 500 ký tự' })
  note?: string | null;
}

export class UpdateAttendanceDto {
  @IsArray({ message: 'records phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => UpdateAttendanceRecordDto)
  records!: UpdateAttendanceRecordDto[];
}
