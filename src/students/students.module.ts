import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentExportService } from './export/student-export.service';
import { StudentImportExecutor } from './import/student-import.executor';
import {
  StudentImportBusinessValidator,
  StudentImportRowValidator,
} from './import/student-import.validator';
import { ExcelModule } from '../common/excel/excel.module';
import { Student } from './entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Branch } from '../branches/entities/branch.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, User, Membership, Branch]),
    AuthModule,
    ExcelModule,
  ],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    StudentExportService,
    StudentImportExecutor,
    StudentImportRowValidator,
    StudentImportBusinessValidator,
  ],
  exports: [
    StudentsService,
    StudentExportService,
    StudentImportExecutor,
    StudentImportRowValidator,
    StudentImportBusinessValidator,
  ],
})
export class StudentsModule {}
