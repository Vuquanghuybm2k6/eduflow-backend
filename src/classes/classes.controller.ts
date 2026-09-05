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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { FindClassesQueryDto } from './dto/find-classes-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createClassDto: CreateClassDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classesService.create(userId, createClassDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: FindClassesQueryDto,
  ) {
    const { organizationId, ...filters } = query;
    return this.classesService.findAll(userId, { organizationId }, filters);
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classesService.findOne(userId, id, { organizationId });
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classesService.update(userId, id, updateClassDto, {
      organizationId,
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classesService.remove(userId, id, { organizationId });
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classesService.duplicate(userId, id, { organizationId });
  }
}
