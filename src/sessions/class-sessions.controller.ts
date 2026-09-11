import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { GenerateSessionsDto } from './dto/generate-sessions.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ClassSessionsController {
  constructor(private readonly classSessionsService: ClassSessionsService) {}

  @Post('classes/:classId/sessions/generate')
  generate(
    @CurrentUser('userId') userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: GenerateSessionsDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classSessionsService.generate(userId, classId, dto, {
      organizationId,
    });
  }

  @Get('classes/:classId/sessions')
  findAll(
    @CurrentUser('userId') userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: SessionQueryDto,
  ) {
    const { organizationId, ...filters } = query;
    return this.classSessionsService.findAll(userId, classId, filters, {
      organizationId,
    });
  }

  @Get('classes/:classId/sessions/:sessionId')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.classSessionsService.findOne(userId, classId, sessionId, {
      organizationId,
    });
  }
}
