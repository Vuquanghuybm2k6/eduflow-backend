import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveGenderToUsers1789012000000 implements MigrationInterface {
  name = 'MoveGenderToUsers1789012000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER')`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "gender" "Gender"`);

    await queryRunner.query(
      `UPDATE "users" u SET "gender" = s.gender::text::"Gender" FROM "students" s WHERE s."userId" = u.id AND u.gender IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "users" u SET "gender" = t.gender::text::"Gender" FROM "teachers" t WHERE t."userId" = u.id AND u.gender IS NULL`,
    );

    await queryRunner.query(`ALTER TABLE "students" DROP COLUMN "gender"`);
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "gender"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "StudentGender"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "TeacherGender"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "TeacherGender" AS ENUM ('MALE', 'FEMALE', 'OTHER')`,
    );
    await queryRunner.query(`ALTER TABLE "students" ADD "gender" "StudentGender"`);
    await queryRunner.query(`ALTER TABLE "teachers" ADD "gender" "TeacherGender"`);

    await queryRunner.query(
      `UPDATE "students" s SET gender = u.gender FROM "users" u WHERE u.id = s."userId"`,
    );
    await queryRunner.query(
      `UPDATE "teachers" t SET gender = u.gender FROM "users" u WHERE u.id = t."userId"`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "Gender"`);
  }
}
