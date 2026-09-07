import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ImportsService } from './imports.service';
import {
  ImportJobResult,
  ImportPreview,
} from './types/import.types';
import type { StudentImportMeta } from '../students/import/student-import.types';
import { IMPORT_MAX_FILE_SIZE_BYTES } from './validators/import-file.validator';

@UseGuards(JwtAuthGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get('students/meta')
  getStudentImportMeta(): StudentImportMeta {
    return this.importsService.getStudentImportMeta();
  }

  @Post('students/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_SIZE_BYTES } }),
  )
  previewStudentImport(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('organizationId') organizationId?: string,
  ): Promise<ImportPreview> {
    return this.importsService.previewStudentImport(file, userId, {
      organizationId,
    });
  }

  @Post('students/confirm')
  confirmStudentImport(
    @CurrentUser('userId') userId: string,
    @Body('importJobId') importJobId: string,
    @Query('organizationId') organizationId?: string,
  ): Promise<ImportJobResult> {
    return this.importsService.confirmStudentImport(importJobId, userId, {
      organizationId,
    });
  }
}
