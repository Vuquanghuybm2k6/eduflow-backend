import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createStudentDto: CreateStudentDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.create(userId, createStudentDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.findAll(userId, { organizationId });
  }

  @Get('me')
  findMe(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.findMe(userId, { organizationId });
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.findOne(userId, id, { organizationId });
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.update(userId, id, updateStudentDto, {
      organizationId,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateStudentStatusDto: UpdateStudentStatusDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.studentsService.updateStatus(
      userId,
      id,
      updateStudentStatusDto,
      { organizationId },
    );
  }
}
