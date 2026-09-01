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
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateTeacherStatusDto } from './dto/update-teacher-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createTeacherDto: CreateTeacherDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.create(userId, createTeacherDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.findAll(userId, { organizationId });
  }

  @Get('me')
  findMe(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.findMe(userId, { organizationId });
  }

  @Get('me/classes')
  findMyClasses(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.findMyClasses(userId, { organizationId });
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.findOne(userId, id, { organizationId });
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.update(userId, id, updateTeacherDto, {
      organizationId,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateTeacherStatusDto: UpdateTeacherStatusDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.teachersService.updateStatus(userId, id, updateTeacherStatusDto, {
      organizationId,
    });
  }
}