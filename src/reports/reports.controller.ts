import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('classes/:classId/attendance-summary')
  getClassAttendanceSummary(
    @CurrentUser('userId') userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.reportsService.getClassAttendanceSummary(userId, classId, {
      organizationId,
    });
  }

  @Get('students/:studentId/attendance-summary')
  getStudentAttendanceSummary(
    @CurrentUser('userId') userId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: AttendanceSummaryQueryDto,
  ) {
    if (query.classId) {
      return this.reportsService.getStudentAttendanceSummaryForClass(
        userId,
        studentId,
        query.classId,
        { organizationId: query.organizationId },
      );
    }

    return this.reportsService.getStudentAttendanceSummary(userId, studentId, {
      organizationId: query.organizationId,
    });
  }

  @Get('students/:studentId/attendance-history')
  getStudentAttendanceHistory(
    @CurrentUser('userId') userId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: AttendanceSummaryQueryDto,
  ) {
    return this.reportsService.getStudentAttendanceHistory(userId, studentId, {
      organizationId: query.organizationId,
      classId: query.classId,
      page: query.page,
      limit: query.limit,
    });
  }
}
