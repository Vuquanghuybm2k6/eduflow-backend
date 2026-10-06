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
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/enums/permission.enum';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('schedules/calendar')
  @Permissions(Permission.SCHEDULES_READ)
  calendar(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.schedulesService.getCalendar(userId, query, organizationId);
  }

  @Post('classes/:classId/schedules/bulk')
  @Permissions(Permission.SCHEDULES_CREATE)
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
  @Permissions(Permission.SCHEDULES_CREATE)
  create(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDHPipe) classId: string,
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(
      classId,
      createScheduleDto,
      organizationId,
    );
  }

  @Get('classes/:classId/schedules')
  @Permissions(Permission.SCHEDULES_READ)
  findAll(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.schedulesService.findAll(classId, organizationId);
  }

  @Patch('schedules/:id')
  @Permissions(Permission.SCHEDULES_UPDATE)
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto, organizationId);
  }

  @Delete('schedules/:id')
  @Permissions(Permission.SCHEDULES_DELETE)
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedulesService.remove(userId, id, organizationId);
  }
}
