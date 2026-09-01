import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePasswordResetTokensToVerificationTokens1788231848328 implements MigrationInterface {
  name = 'RenamePasswordResetTokensToVerificationTokens1788231848328';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" RENAME TO "verification_tokens"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_password_reset_tokens_email" RENAME TO "IDX_verification_tokens_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" RENAME CONSTRAINT "PK_password_reset_tokens" TO "PK_verification_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" RENAME CONSTRAINT "UQ_password_reset_tokens_tokenHash" TO "UQ_verification_tokens_tokenHash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" RENAME CONSTRAINT "UQ_verification_tokens_tokenHash" TO "UQ_password_reset_tokens_tokenHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" RENAME CONSTRAINT "PK_verification_tokens" TO "PK_password_reset_tokens"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_verification_tokens_email" RENAME TO "IDX_password_reset_tokens_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verification_tokens" RENAME TO "password_reset_tokens"`,
    );
  }
}
