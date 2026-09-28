import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { AppDataSource } from '../data-source';
import {
  PERMISSION_SEEDS,
  SYSTEM_ROLES,
} from '../authorization/constants/system-role-permissions.constant';

const logger = new Logger('AuthorizationSeed');

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSION_SEEDS) {
    await AppDataSource.manager.query(
      `INSERT INTO "permissions"
         ("id", "code", "name", "description", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), $1, $2, $3, now(), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "permissions" WHERE "code" = $1
       )`,
      [permission.code, permission.name, permission.description],
    );
  }
}

async function seedRoles(): Promise<void> {
  const backfills: Array<{ code: string; names: string[] }> = [
    { code: 'OWNER', names: ['organization owner', 'owner'] },
    { code: 'ADMIN', names: ['admin', 'administrator'] },
    { code: 'TEACHER', names: ['teacher'] },
    { code: 'STUDENT', names: ['student'] },
  ];

  for (const backfill of backfills) {
    await AppDataSource.manager.query(
      `UPDATE "roles" SET "code" = $1
       WHERE "code" IS NULL AND "organizationId" IS NOT NULL
         AND LOWER("name") = ANY($2::text[])`,
      [backfill.code, backfill.names],
    );
  }

  for (const role of SYSTEM_ROLES) {
    await AppDataSource.manager.query(
      `INSERT INTO "roles"
         ("id", "code", "name", "description", "organizationId", "isSystem", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), $1, $2, $3, NULL, true, now(), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "roles" WHERE "code" = $1 AND "organizationId" IS NULL
       )`,
      [role.code, role.name, role.description],
    );
  }
}

async function seedRolePermissions(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await AppDataSource.manager.query(
      `INSERT INTO "role_permissions"
         ("id", "roleId", "permissionId", "createdAt")
       SELECT gen_random_uuid(), r."id", p."id", now()
       FROM "roles" r
       JOIN "permissions" p ON p."code" = ANY($2::text[])
       WHERE r."code" = $1
       ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
      [role.code, role.permissions],
    );
  }
}

interface CountRow {
  n: number;
}

async function countRows(query: string): Promise<number> {
  const rows: CountRow[] = await AppDataSource.manager.query(query);
  return rows[0]?.n ?? 0;
}

async function main(): Promise<void> {
  try {
    await AppDataSource.initialize();
    await seedPermissions();
    await seedRoles();
    await seedRolePermissions();

    const roleCount = await countRows(
      `SELECT COUNT(*)::int AS n FROM "roles" WHERE "code" IS NOT NULL`,
    );
    const permissionCount = await countRows(
      `SELECT COUNT(*)::int AS n FROM "permissions"`,
    );
    const mappingCount = await countRows(
      `SELECT COUNT(*)::int AS n FROM "role_permissions"`,
    );

    logger.log(
      `Authorization seed complete. roles=${roleCount} permissions=${permissionCount} role_permissions=${mappingCount}`,
    );
  } catch (error) {
    logger.error('Authorization seed failed', (error as Error).stack);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

void main();
