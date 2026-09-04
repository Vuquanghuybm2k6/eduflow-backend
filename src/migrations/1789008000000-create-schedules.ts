import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedules1789008000000 implements MigrationInterface {
  name = 'CreateSchedules1789008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')`,
    );

    await queryRunner.query(`
      CREATE TABLE "schedules" (
        "id" text NOT NULL,
        "classId" text NOT NULL,
        "dayOfWeek" "DayOfWeek" NOT NULL,
        "startTime" time NOT NULL,
        "endTime" time NOT NULL,
        "room" character varying(100),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_schedules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_schedules_classId" ON "schedules" ("classId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedules_classId_dayOfWeek" ON "schedules" ("classId", "dayOfWeek")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedules" ADD CONSTRAINT "FK_schedules_classId" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "schedules" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "DayOfWeek"`);
  }
}