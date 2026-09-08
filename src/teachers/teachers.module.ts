import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { TeacherExportService } from './export/teacher-export.service';
import {
  TeacherImportBusinessValidator,
  TeacherImportRowValidator,
} from './import/teacher-import.validator';
import { TeacherImportExecutor } from './import/teacher-import.executor';
import { Teacher } from './entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Class } from '../classes/entities/class.entity';
import { Branch } from '../branches/entities/branch.entity';
import { AuthModule } from '../auth/auth.module';
import { ExcelModule } from '../common/excel/excel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Teacher, User, Membership, Class, Branch]),
    AuthModule,
    ExcelModule,
  ],
  controllers: [TeachersController],
  providers: [
    TeachersService,
    TeacherExportService,
    TeacherImportRowValidator,
    TeacherImportBusinessValidator,
    TeacherImportExecutor,
  ],
  exports: [
    TeachersService,
    TeacherExportService,
    TeacherImportRowValidator,
    TeacherImportBusinessValidator,
    TeacherImportExecutor,
  ],
})
export class TeachersModule {}
