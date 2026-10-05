import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ClassSessionsService } from './class-sessions.service';
import { GenerateSessionsDto } from './dto/generate-sessions.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';

@Controller()
export class ClassSessionsController {
  constructor(private readonly classSessionsService: ClassSessionsService) {}

  @Post('classes/:classId/sessions/generate')
  generate(
    @CurrentUser('userId') userId: string,
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: GenerateSessionsDto,
  ) {
    return this.classSessionsService.generate(
      userId,
      classId,
      dto,
      organizationId,
    );
  }

  @Get('classes/:classId/sessions')
  findAll(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: SessionQueryDto,
  ) {
    return this.classSessionsService.findAll(classId, query, organizationId);
  }

  @Get('classes/:classId/sessions/:sessionId')
  findOne(
    @CurrentOrganization() organizationId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.classSessionsService.findOne(
      classId,
      sessionId,
      organizationId,
    );
  }
}
