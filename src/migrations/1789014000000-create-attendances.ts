import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendances1789014000000 implements MigrationInterface {
  name = 'CreateAttendances1789014000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" text NOT NULL,
        "organization_id" text NOT NULL,
        "session_id" text NOT NULL,
        "student_id" text NOT NULL,
        "status" "AttendanceStatus" NOT NULL,
        "note" character varying(500),
        "marked_at" TIMESTAMPTZ,
        "marked_by" text,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendances" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_organization_id" ON "attendances" ("organization_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_session_id" ON "attendances" ("session_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_student_id" ON "attendances" ("student_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "UQ_attendances_session_id_student_id" UNIQUE ("session_id", "student_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_session_id" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_marked_by" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendances" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "AttendanceStatus"`);
  }
}
