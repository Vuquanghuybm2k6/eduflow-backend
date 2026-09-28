import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sessions/:sessionId/attendance')
  getSessionAttendance(
    @CurrentUser('userId') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.attendanceService.getSessionAttendance(userId, sessionId, {
      organizationId,
    });
  }

  @Put('sessions/:sessionId/attendance')
  updateSessionAttendance(
    @CurrentUser('userId') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateAttendanceDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.attendanceService.updateSessionAttendance(
      userId,
      sessionId,
      dto,
      { organizationId },
    );
  }
}
