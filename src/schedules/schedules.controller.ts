import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateSessionsDto } from './dto/create-sessions.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('schedules/calendar')
  calendar(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.schedulesService.getCalendar(userId, query, organizationId);
  }

  @Post('classes/:classId/schedules/bulk')
  createBulk(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() createSessionsDto: CreateSessionsDto,
  ) {
    return this.schedulesService.createBulk(
      classId,
      createSessionsDto,
      organizationId,
    );
  }

  @Post('classes/:classId/schedules')
  create(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(
      classId,
      createScheduleDto,
      organizationId,
    );
  }

  @Get('classes/:classId/schedules')
  findAll(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.schedulesService.findAll(classId, organizationId);
  }

  @Patch('schedules/:id')
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto, organizationId);
  }

  @Delete('schedules/:id')
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulesService.remove(userId, id, organizationId);
  }
}
