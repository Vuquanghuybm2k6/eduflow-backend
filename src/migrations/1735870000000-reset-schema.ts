import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResetSchema1735870000000 implements MigrationInterface {
  name = 'ResetSchema1735870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `DROP TABLE IF EXISTS "_prisma_migrations" CASCADE`,
    );

    await queryRunner.query(`DROP TYPE IF EXISTS "AcademicYearStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "BranchStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "MembershipStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "UserStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "OrganizationStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "OtpPurpose"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset is destructive; nothing to restore here.
  }
}
