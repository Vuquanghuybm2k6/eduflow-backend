import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { ImportsService } from './imports.service';
import { ImportJobResult, ImportPreview } from './types/import.types';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import type { StudentImportMeta } from '../students/import/student-import.types';
import { TEACHER_IMPORT_MAX_FILE_SIZE_BYTES } from '../teachers/import/teacher-import.constants';
import type {
  TeacherImportMeta,
  TeacherImportPreview,
} from '../teachers/import/teacher-import.types';
import { IMPORT_MAX_FILE_SIZE_BYTES } from './validators/import-file.validator';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('students/meta')
  getStudentImportMeta(): StudentImportMeta {
    return this.importsService.getStudentImportMeta();
  }

  @Post('students/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MAX_FILE_SIZE_BYTES },
    }),
  )
  previewStudentImport(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportPreview> {
    return this.importsService.previewStudentImport(
      file,
      userId,
      organizationId,
    );
  }

  @Post('students/confirm')
  confirmStudentImport(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: ConfirmImportDto,
  ): Promise<ImportJobResult> {
    return this.importsService.confirmStudentImport(
      dto.importJobId,
      userId,
      organizationId,
    );
  }

  @Get('teachers/meta')
  getTeacherImportMeta(): TeacherImportMeta {
    return this.importsService.getTeacherImportMeta();
  }

  @Post('teachers/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TEACHER_IMPORT_MAX_FILE_SIZE_BYTES },
    }),
  )
  previewTeacherImport(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TeacherImportPreview> {
    return this.importsService.previewTeacherImport(
      file,
      userId,
      organizationId,
    );
  }

  @Post('teachers/confirm')
  confirmTeacherImport(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Body() dto: ConfirmImportDto,
  ): Promise<ImportJobResult> {
    return this.importsService.confirmTeacherImport(
      dto.importJobId,
      userId,
      organizationId,
    );
  }
}
