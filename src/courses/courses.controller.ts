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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createCourseDto: CreateCourseDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coursesService.create(userId, createCourseDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coursesService.findAll(userId, { organizationId });
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coursesService.findOne(userId, id, { organizationId });
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coursesService.update(userId, id, updateCourseDto, {
      organizationId,
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.coursesService.remove(userId, id, { organizationId });
  }
}
