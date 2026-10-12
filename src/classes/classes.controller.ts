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
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '../authorization/enums/permission.enum';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Permissions(Permission.CLASSES_CREATE)
  create(
    @CurrentOrganization() organizationId: string,
    @Body() createClassDto: CreateClassDto,
  ) {
    return this.classesService.create(createClassDto, organizationId);
  }

  @Get()
  @Permissions(Permission.CLASSES_READ)
  findAll(
    @CurrentOrganization() organizationId: string,
    @Query() query: FindClassesQueryDto,
  ) {
    return this.classesService.findAll(query, organizationId);
  }

  @Get(':id')
  @Permissions(Permission.CLASSES_READ)
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.findOne(id, organizationId);
  }

  @Patch(':id')
  @Permissions(Permission.CLASSES_UPDATE)
  update(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.classesService.update(id, updateClassDto, organizationId);
  }

  @Delete(':id')
  @Permissions(Permission.CLASSES_DELETE)
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.remove(userId, id, organizationId);
  }

  @Post(':id/duplicate')
  @Permissions(Permission.CLASSES_CREATE)
  duplicate(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.classesService.duplicate(id, organizationId);
  }
}
