import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeacherGender1789011000000 implements MigrationInterface {
  name = 'AddTeacherGender1789011000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "TeacherGender" AS ENUM ('MALE', 'FEMALE', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD "gender" "TeacherGender"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "gender"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "TeacherGender"`);
  }
}
