import { IsEnum, IsNotEmpty } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

export class UpdateStudentStatusDto {
  @IsEnum(StudentStatus)
  @IsNotEmpty()
  status!: StudentStatus;
}
