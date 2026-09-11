import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassSessions1789013000000 implements MigrationInterface {
  name = 'CreateClassSessions1789013000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ClassSessionType" AS ENUM ('REGULAR', 'MAKEUP')`,
    );

    await queryRunner.query(
      `CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "class_sessions" (
        "id" text NOT NULL,
        "organization_id" text NOT NULL,
        "class_id" text NOT NULL,
        "schedule_id" text,
        "teacher_id" text NOT NULL,
        "session_date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "room" character varying(100),
        "type" "ClassSessionType" NOT NULL DEFAULT 'REGULAR',
        "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
        "note" text,
        "rescheduled_from_session_id" text,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_sessions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_class_sessions_organization_id" ON "class_sessions" ("organization_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_class_sessions_class_id" ON "class_sessions" ("class_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_class_sessions_session_date" ON "class_sessions" ("session_date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_class_sessions_class_id_session_date" ON "class_sessions" ("class_id", "session_date")`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "UQ_class_sessions_class_id_session_date" UNIQUE ("class_id", "session_date")`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "FK_class_sessions_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "FK_class_sessions_class_id" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "FK_class_sessions_schedule_id" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "FK_class_sessions_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "class_sessions" ADD CONSTRAINT "FK_class_sessions_rescheduled_from_session_id" FOREIGN KEY ("rescheduled_from_session_id") REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "class_sessions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ClassSessionStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ClassSessionType"`);
  }
}
