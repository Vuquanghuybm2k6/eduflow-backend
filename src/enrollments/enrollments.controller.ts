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
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createEnrollmentDto: CreateEnrollmentDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.create(userId, createEnrollmentDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.findAll(userId, { organizationId });
  }

  @Get('student/:studentId')
  findByStudent(
    @CurrentUser('userId') userId: string,
    @Param('studentId') studentId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.findByStudent(userId, studentId, {
      organizationId,
    });
  }

  @Get('class/:classId')
  findByClass(
    @CurrentUser('userId') userId: string,
    @Param('classId') classId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.findByClass(userId, classId, {
      organizationId,
    });
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.findOne(userId, id, { organizationId });
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateEnrollmentStatusDto: UpdateEnrollmentStatusDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.updateStatus(
      userId,
      id,
      updateEnrollmentStatusDto,
      { organizationId },
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.enrollmentsService.remove(userId, id, { organizationId });
  }
}
