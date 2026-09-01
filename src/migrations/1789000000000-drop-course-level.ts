import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCourseLevel1789000000000 implements MigrationInterface {
  name = 'DropCourseLevel1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "level"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "CourseLevel"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "CourseLevel" AS ENUM ('beginner', 'intermediate', 'advanced')`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" ADD "level" "CourseLevel" NOT NULL DEFAULT 'beginner'`,
    );
  }
}
