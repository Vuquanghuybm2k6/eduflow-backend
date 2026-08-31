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
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createAcademicYearDto: CreateAcademicYearDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.create(userId, createAcademicYearDto, {
      organizationId,
    });
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.findAll(userId, { organizationId });
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.findOne(userId, id, { organizationId });
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateAcademicYearDto: UpdateAcademicYearDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.update(userId, id, updateAcademicYearDto, {
      organizationId,
    });
  }

  @Patch(':id/activate')
  activate(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.activate(userId, id, { organizationId });
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.academicYearsService.remove(userId, id, { organizationId });
  }
}
