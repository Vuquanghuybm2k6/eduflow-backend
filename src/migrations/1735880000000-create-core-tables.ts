import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreTables1735880000000 implements MigrationInterface {
  name = 'CreateCoreTables1735880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== ENUM TYPES =====
    await queryRunner.query(
      `CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "BranchStatus" AS ENUM ('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "AcademicYearStatus" AS ENUM ('active', 'inactive', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "OtpPurpose" AS ENUM ('password_reset', 'registration')`,
    );

    // ===== 1. organizations =====
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "email" text,
        "phone" text,
        "address" text,
        "logoUrl" text,
        "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug")`,
    );

    // ===== 2. users =====
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" text NOT NULL,
        "email" text NOT NULL,
        "passwordHash" text,
        "fullName" text NOT NULL,
        "phone" text,
        "avatarUrl" text,
        "googleId" text,
        "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_googleId" ON "users" ("googleId") WHERE "googleId" IS NOT NULL`,
    );

    // ===== 3. permissions =====
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "UQ_permissions_name" UNIQUE ("name")`,
    );

    // ===== 4. roles =====
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "organizationId" text,
        "isSystem" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_roles_organizationId" ON "roles" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "UQ_roles_organizationId_name" UNIQUE ("organizationId", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "FK_roles_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // ===== 5. role_permissions =====
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" text NOT NULL,
        "roleId" text NOT NULL,
        "permissionId" text NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_role_permissions_permissionId" ON "role_permissions" ("permissionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "UQ_role_permissions_roleId_permissionId" UNIQUE ("roleId", "permissionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_permissionId" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // ===== 6. memberships =====
    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" text NOT NULL,
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "roleId" text NOT NULL,
        "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
        "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_memberships_userId" ON "memberships" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_memberships_organizationId" ON "memberships" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "UQ_memberships_userId_organizationId" UNIQUE ("userId", "organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "FK_memberships_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id")`,
    );

    // ===== 7. refresh_tokens =====
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" text NOT NULL,
        "userId" text NOT NULL,
        "tokenHash" text NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "revokedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "UQ_refresh_tokens_tokenHash" UNIQUE ("tokenHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // ===== 8. password_reset_tokens =====
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" text NOT NULL,
        "email" text NOT NULL,
        "tokenHash" text NOT NULL,
        "purpose" "OtpPurpose" NOT NULL DEFAULT 'password_reset',
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_email" ON "password_reset_tokens" ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "UQ_password_reset_tokens_tokenHash" UNIQUE ("tokenHash")`,
    );

    // ===== 9. branches =====
    await queryRunner.query(`
      CREATE TABLE "branches" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "name" text NOT NULL,
        "code" text NOT NULL,
        "address" text,
        "phone" text,
        "status" "BranchStatus" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_branches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_organizationId" ON "branches" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_branches_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // ===== 10. academic_years =====
    await queryRunner.query(`
      CREATE TABLE "academic_years" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "name" text NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "status" "AcademicYearStatus" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_academic_years" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_years_organizationId" ON "academic_years" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" ADD CONSTRAINT "UQ_academic_years_organizationId_name" UNIQUE ("organizationId", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" ADD CONSTRAINT "FK_academic_years_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "academic_years" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "password_reset_tokens" CASCADE`,
    );

    await queryRunner.query(`DROP TYPE IF EXISTS "AcademicYearStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "BranchStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "MembershipStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "UserStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "OrganizationStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "OtpPurpose"`);
  }
}
