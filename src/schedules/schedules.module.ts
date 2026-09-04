import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { Class } from '../classes/entities/class.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Class, Membership])],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
