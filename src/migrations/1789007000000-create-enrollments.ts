import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnrollments1789007000000 implements MigrationInterface {
  name = 'CreateEnrollments1789007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "enrollments" (
        "id" text NOT NULL,
        "student_id" text NOT NULL,
        "class_id" text NOT NULL,
        "enrolled_at" TIMESTAMP NOT NULL DEFAULT now(),
        "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enrollments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_enrollments_student_id" ON "enrollments" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_enrollments_class_id" ON "enrollments" ("class_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "UQ_enrollments_student_id_class_id" UNIQUE ("student_id", "class_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_class_id" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "enrollments" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "EnrollmentStatus"`);
  }
}
