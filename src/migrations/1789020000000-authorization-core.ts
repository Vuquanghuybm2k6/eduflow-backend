import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  PERMISSION_SEEDS,
  SYSTEM_ROLES,
} from '../authorization/constants/system-role-permissions.constant';

export class AuthorizationCore1789020000000 implements MigrationInterface {
  name = 'AuthorizationCore1789020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== 1. Add `code` columns =====
    await queryRunner.query(`ALTER TABLE "roles" ADD COLUMN "code" text`);
    await queryRunner.query(`ALTER TABLE "permissions" ADD COLUMN "code" text`);

    // ===== 2. Backfill codes on existing organization-scoped system roles =====
    await queryRunner.query(
      `UPDATE "roles" SET "code" = 'OWNER'
       WHERE "code" IS NULL AND "organizationId" IS NOT NULL
         AND LOWER("name") IN ('organization owner', 'owner')`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "code" = 'ADMIN'
       WHERE "code" IS NULL AND "organizationId" IS NOT NULL
         AND LOWER("name") IN ('admin', 'administrator')`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "code" = 'TEACHER'
       WHERE "code" IS NULL AND "organizationId" IS NOT NULL
         AND LOWER("name") = 'teacher'`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "code" = 'STUDENT'
       WHERE "code" IS NULL AND "organizationId" IS NOT NULL
         AND LOWER("name") = 'student'`,
    );

    // ===== 3. Unique indexes (prevent duplicate codes) =====
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_roles_organizationId_code"
       ON "roles" ("organizationId", "code")
       WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_permissions_code"
       ON "permissions" ("code")
       WHERE "code" IS NOT NULL`,
    );

    // ===== 4. Seed global system roles (idempotent) =====
    for (const role of SYSTEM_ROLES) {
      await queryRunner.query(
        `INSERT INTO "roles"
           ("id", "code", "name", "description", "organizationId", "isSystem", "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, $2, $3, NULL, true, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM "roles" WHERE "code" = $1 AND "organizationId" IS NULL
         )`,
        [role.code, role.name, role.description],
      );
    }

    // ===== 5. Seed permissions (idempotent) =====
    for (const permission of PERMISSION_SEEDS) {
      await queryRunner.query(
        `INSERT INTO "permissions"
           ("id", "code", "name", "description", "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, $2, $3, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM "permissions" WHERE "code" = $1
         )`,
        [permission.code, permission.name, permission.description],
      );
    }

    // ===== 6. Attach default role -> permission mappings =====
    // Applies to both the global system roles and any backfilled
    // organization-scoped system roles that carry the same code.
    for (const role of SYSTEM_ROLES) {
      await queryRunner.query(
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permissions_code"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_roles_organizationId_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP COLUMN IF EXISTS "code"`,
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN IF EXISTS "code"`);
  }
}
