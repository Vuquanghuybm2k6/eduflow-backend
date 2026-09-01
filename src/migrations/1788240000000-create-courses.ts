import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCourses1788240000000 implements MigrationInterface {
  name = 'CreateCourses1788240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "CourseStatus" AS ENUM ('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "CourseLevel" AS ENUM ('beginner', 'intermediate', 'advanced')`,
    );

    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "name" text NOT NULL,
        "code" text NOT NULL,
        "description" text,
        "level" "CourseLevel" NOT NULL DEFAULT 'beginner',
        "duration" integer,
        "status" "CourseStatus" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_courses_organizationId" ON "courses" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" ADD CONSTRAINT "UQ_courses_organizationId_code" UNIQUE ("organizationId", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "courses" ADD CONSTRAINT "FK_courses_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "courses" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "CourseLevel"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "CourseStatus"`);
  }
}
