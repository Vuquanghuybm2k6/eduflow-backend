import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExcelModule } from '../common/excel/excel.module';
import { AuthModule } from '../auth/auth.module';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { Membership } from '../memberships/entities/membership.entity';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobRow } from './entities/import-job-row.entity';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportFileValidator } from './validators/import-file.validator';
import { ImportHeaderValidator } from './validators/import-header.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, ImportJob, ImportJobRow]),
    ExcelModule,
    AuthModule,
    StudentsModule,
    TeachersModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService, ImportFileValidator, ImportHeaderValidator],
  exports: [ImportsService, ImportFileValidator, ImportHeaderValidator],
})
export class ImportsModule {}
