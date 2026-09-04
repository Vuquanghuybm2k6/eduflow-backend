import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DayOfWeek } from '../entities/schedule.entity';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateScheduleDto {
  @IsEnum(DayOfWeek, { message: 'dayOfWeek phải thuộc các ngày trong tuần' })
  dayOfWeek!: DayOfWeek;

  @Matches(TIME_PATTERN, {
    message: 'startTime phải có định dạng HH:mm (ví dụ 08:00)',
  })
  startTime!: string;

  @Matches(TIME_PATTERN, {
    message: 'endTime phải có định dạng HH:mm (ví dụ 20:00)',
  })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;
}
