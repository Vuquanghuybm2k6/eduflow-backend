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
import { StudentsService } from './students.service';
import { StudentExportService } from './export/student-export.service';
import { StudentImportTemplateService } from './import/student-import-template.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { ExportStudentsQueryDto } from './dto/export-students-query.dto';
import { DownloadImportTemplateQueryDto } from '../imports/dto/download-import-template-query.dto';
import { DEFAULT_IMPORT_TEMPLATE_LANGUAGE } from '../imports/import-template.constants';
import { EXCEL_MIME_TYPE } from '../common/excel/excel.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentExportService: StudentExportService,
    private readonly studentImportTemplateService: StudentImportTemplateService,
  ) {}

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

  @Get('export')
  async exportStudents(
    @CurrentUser('userId') userId: string,
    @Query() query: ExportStudentsQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.studentExportService.export(
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
      await this.studentImportTemplateService.download(
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
