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
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/enums/permission.enum';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Permissions(Permission.COURSES_CREATE)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() createCourseDto: CreateCourseDto,
  ) {
    return this.coursesService.create(createCourseDto, organizationId);
  }

  @Get()
  @Permissions(Permission.COURSES_READ)
  findAll(@CurrentOrganization() organizationId: string) {
    return this.coursesService.findAll(organizationId);
  }

  @Get(':id')
  @Permissions(Permission.COURSES_READ)
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.findOne(id, organizationId);
  }

  @Patch(':id')
  @Permissions(Permission.COURSES_UPDATE)
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, updateCourseDto, organizationId);
  }

  @Delete(':id')
  @Permissions(Permission.COURSES_DELETE)
  remove(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.coursesService.remove(id, organizationId);
  }
}
