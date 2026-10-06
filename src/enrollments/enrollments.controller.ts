import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/enums/permission.enum';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Permissions(Permission.ENROLLMENTS_CREATE)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() createEnrollmentDto: CreateEnrollmentDto,
  ) {
    return this.enrollmentsService.create(createEnrollmentDto, organizationId);
  }

  @Get()
  @Permissions(Permission.ENROLLMENTS_READ)
  findAll(@CurrentOrganization() organizationId: string) {
    return this.enrollmentsService.findAll(organizationId);
  }

  @Get('student/:studentId')
  @Permissions(Permission.ENROLLMENTS_READ)
  findByStudent(
    @CurrentOrganization() organizationId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.enrollmentsService.findByStudent(studentId, organizationId);
  }

  @Get('class/:classId')
  @Permissions(Permission.ENROLLMENTS_READ)
  findByClass(
    @CurrentOrganization() organizationId: string,
    @Param('classId') classId: string,
  ) {
    return this.enrollmentsService.findByClass(classId, organizationId);
  }

  @Get(':id')
  @Permissions(Permission.ENROLLMENTS_READ)
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.enrollmentsService.findOne(id, organizationId);
  }

  @Patch(':id/status')
  @Permissions(Permission.ENROLLMENTS_UPDATE)
  updateStatus(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateEnrollmentStatusDto: UpdateEnrollmentStatusDto,
  ) {
    return this.enrollmentsService.updateStatus(
      id,
      updateEnrollmentStatusDto,
      organizationId,
    );
  }

  @Delete(':id')
  @Permissions(Permission.ENROLLMENTS_UPDATE)
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.enrollmentsService.remove(id, organizationId);
  }
}
