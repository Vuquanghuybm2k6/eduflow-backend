import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeacherExportService } from './export/teacher-export.service';
import { TeacherImportTemplateService } from './import/teacher-import-template.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateTeacherStatusDto } from './dto/update-teacher-status.dto';
import { ExportTeachersQueryDto } from './dto/export-teachers-query.dto';
import { DownloadImportTemplateQueryDto } from '../imports/dto/download-import-template-query.dto';
import { DEFAULT_IMPORT_TEMPLATE_LANGUAGE } from '../imports/import-template.constants';
import { EXCEL_MIME_TYPE } from '../common/excel/excel.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly teacherExportService: TeacherExportService,
    private readonly teacherImportTemplateService: TeacherImportTemplateService,
  ) {}

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

  @Get('export')
  async exportTeachers(
    @CurrentUser('userId') userId: string,
    @Query() query: ExportTeachersQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.teacherExportService.export(
      userId,
      query,
    );

    return new StreamableFile(buffer, {
      type: EXCEL_MIME_TYPE,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('import/template')
  async downloadImportTemplate(
    @CurrentUser('userId') userId: string,
    @Query() query: DownloadImportTemplateQueryDto = {},
  ): Promise<StreamableFile> {
    const { buffer, filename } =
      await this.teacherImportTemplateService.download(
        userId,
        query.lang ?? DEFAULT_IMPORT_TEMPLATE_LANGUAGE,
      );

    return new StreamableFile(buffer, {
      type: EXCEL_MIME_TYPE,
      disposition: `attachment; filename="${filename}"`,
    });
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
    return this.teachersService.updateStatus(
      userId,
      id,
      updateTeacherStatusDto,
      {
        organizationId,
      },
    );
  }
}
