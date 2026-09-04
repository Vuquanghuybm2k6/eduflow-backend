import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateScheduleDto } from './create-schedule.dto';

export class CreateSessionsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Phải có ít nhất một buổi học' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 buổi học mỗi lần' })
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleDto)
  sessions!: CreateScheduleDto[];
}
