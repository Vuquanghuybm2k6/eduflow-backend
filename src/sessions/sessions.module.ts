import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSession } from './entities/class-session.entity';
import { Class } from '../classes/entities/class.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { ClassSessionsService } from './class-sessions.service';
import { ClassSessionsController } from './class-sessions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassSession,
      Class,
      Schedule,
      Membership,
      Attendance,
    ]),
    AuthModule,
  ],
  controllers: [ClassSessionsController],
  providers: [ClassSessionsService],
  exports: [ClassSessionsService],
})
export class ClassSessionsModule {}
