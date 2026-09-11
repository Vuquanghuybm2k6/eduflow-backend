import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './entities/attendance.entity';
import { ClassSession } from '../sessions/entities/class-session.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Enrollment } from '../enrollments/entities/enrollment.entity';
import { Teacher } from '../teachers/entities/teacher.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      ClassSession,
      Membership,
      Enrollment,
      Teacher,
    ]),
    AuthModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
