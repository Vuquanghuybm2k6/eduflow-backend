import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExcelModule } from '../common/excel/excel.module';
import { AuthModule } from '../auth/auth.module';
import { StudentsModule } from '../students/students.module';
import { Membership } from '../memberships/entities/membership.entity';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobRow } from './entities/import-job-row.entity';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportFileValidator } from './validators/import-file.validator';
import { ImportHeaderValidator } from './validators/import-header.validator';
import { ImportRowValidator } from './validators/import-row.validator';
import { ImportBusinessValidator } from './validators/import-business.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      Student,
      User,
      Branch,
      ImportJob,
      ImportJobRow,
    ]),
    ExcelModule,
    AuthModule,
    StudentsModule,
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportFileValidator,
    ImportHeaderValidator,
    ImportRowValidator,
    ImportBusinessValidator,
  ],
})
export class ImportsModule {}