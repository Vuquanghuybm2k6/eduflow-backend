import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Public } from '../authorization/decorators/public.decorator';

/**
 * Public health endpoints used by container orchestrators and CI.
 * Implemented directly on top of DataSource to avoid pulling an ESM-only
 * health dependency into the CommonJS test/runtime pipeline.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      info: { database: { status: 'up' } },
    };
  }
}
