import {
  Body,
  Controller,
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
import { ImportJobResult, ImportPreview } from './types/import.types';

@UseGuards(JwtAuthGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('students/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
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
