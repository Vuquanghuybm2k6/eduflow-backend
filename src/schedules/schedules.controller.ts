import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateSessionsDto } from './dto/create-sessions.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('classes/:classId/schedules/bulk')
  createBulk(
    @CurrentUser('userId') userId: string,
    @Param('classId') classId: string,
    @Body() createSessionsDto: CreateSessionsDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.schedulesService.createBulk(
      userId,
      classId,
      createSessionsDto,
      { organizationId },
    );
  }

  @Post('classes/:classId/schedules')
  create(
    @CurrentUser('userId') userId: string,
    @Param('classId') classId: string,
    @Body() createScheduleDto: CreateScheduleDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.schedulesService.create(userId, classId, createScheduleDto, {
      organizationId,
    });
  }

  @Get('classes/:classId/schedules')
  findAll(
    @CurrentUser('userId') userId: string,
    @Param('classId') classId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.schedulesService.findAll(userId, classId, { organizationId });
  }

  @Patch('schedules/:id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.schedulesService.update(userId, id, updateScheduleDto, {
      organizationId,
    });
  }

  @Delete('schedules/:id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.schedulesService.remove(userId, id, { organizationId });
  }
}
