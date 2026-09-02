import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateClassDto } from './create-class.dto';
import { ClassStatus } from '../entities/class.entity';

export class UpdateClassDto extends PartialType(CreateClassDto) {
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;
}
