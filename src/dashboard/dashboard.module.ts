import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Student } from '../students/entities/student.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { Class } from '../classes/entities/class.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Teacher,
      Class,
      Attendance,
      Membership,
      Enrollment,
      ClassSession,
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
