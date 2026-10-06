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
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/enums/permission.enum';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('sessions/:sessionId/attendance')
  @Permissions(Permission.ATTENDANCE_READ)
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
  @Permissions(Permission.ATTENDANCE_UPDATE)
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
