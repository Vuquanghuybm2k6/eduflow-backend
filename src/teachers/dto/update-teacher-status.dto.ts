import { IsEnum, IsNotEmpty } from 'class-validator';
import { TeacherStatus } from '../entities/teacher.entity';

export class UpdateTeacherStatusDto {
  @IsEnum(TeacherStatus)
  @IsNotEmpty()
  status!: TeacherStatus;
}
