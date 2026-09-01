import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTuitionFeeToCourses1789001000000 implements MigrationInterface {
  name = 'AddTuitionFeeToCourses1789001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "courses" ADD "tuitionFee" numeric(12,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "tuitionFee"`);
  }
}