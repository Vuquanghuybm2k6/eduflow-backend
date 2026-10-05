import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { FindClassesQueryDto } from './dto/find-classes-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(
    @CurrentOrganization() organizationId: string,
    @Body() createClassDto: CreateClassDto,
  ) {
    return this.classesService.create(createClassDto, organizationId);
  }

  @Get()
  findAll(
    @CurrentOrganization() organizationId: string,
    @Query() query: FindClassesQueryDto,
  ) {
    return this.classesService.findAll(query, organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.classesService.update(id, updateClassDto, organizationId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.remove(userId, id, organizationId);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.duplicate(id, organizationId);
  }
}
