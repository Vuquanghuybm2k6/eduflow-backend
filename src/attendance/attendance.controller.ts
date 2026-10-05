import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sessions/:sessionId/attendance')
  getSessionAttendance(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.attendanceService.getSessionAttendance(
      userId,
      organizationId,
      sessionId,
    );
  }

  @Put('sessions/:sessionId/attendance')
  updateSessionAttendance(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.updateSessionAttendance(
      userId,
      sessionId,
      dto,
      organizationId,
    );
  }
}
