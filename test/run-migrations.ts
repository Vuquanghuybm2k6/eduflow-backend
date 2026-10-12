import 'reflect-metadata';
import { Logger } from '@nestjs/common';

import { AppDataSource } from '../src/data-source';

const logger = new Logger('TestMigrate');

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const ran = await AppDataSource.runMigrations();
    logger.log(
      `Ran ${ran.length} migration(s) against ${process.env.DATABASE_URL}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  logger.error('Test migration failed', (error as Error).stack);
  process.exitCode = 1;
});
