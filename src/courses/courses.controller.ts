import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  create(
    @CurrentOrganization() organizationId: string,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    return this.coursesService.create(createCourseDto, organizationId);
  }

  @Get()
  findAll(@CurrentOrganization() organizationId: string) {
    return this.coursesService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, updateCourseDto, organizationId);
  }

  @Delete(':id')
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.remove(id, organizationId);
  }
}
