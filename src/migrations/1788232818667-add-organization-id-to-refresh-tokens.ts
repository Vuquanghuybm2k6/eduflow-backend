import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdToRefreshTokens1788232818667
  implements MigrationInterface
{
  name = 'AddOrganizationIdToRefreshTokens1788232818667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "organizationId" text`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_organizationId" ON "refresh_tokens" ("organizationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_refresh_tokens_organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "organizationId"`,
    );
  }
}
