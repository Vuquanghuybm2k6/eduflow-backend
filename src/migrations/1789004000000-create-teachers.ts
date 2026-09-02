import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeachers1789004000000 implements MigrationInterface {
  name = 'CreateTeachers1789004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "teachers" (
        "id" text NOT NULL,
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "teacherCode" text NOT NULL,
        "specialization" text,
        "qualification" text,
        "bio" text,
        "hireDate" date,
        "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teachers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_teachers_userId" ON "teachers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_teachers_organizationId" ON "teachers" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD CONSTRAINT "UQ_teachers_userId" UNIQUE ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD CONSTRAINT "UQ_teachers_organizationId_teacherCode" UNIQUE ("organizationId", "teacherCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD CONSTRAINT "FK_teachers_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "teachers" ADD CONSTRAINT "FK_teachers_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_teacherId"`,
    );
    await queryRunner.query(`UPDATE "classes" SET "teacherId" = NULL`);
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_teacherId" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classes" DROP CONSTRAINT "FK_classes_teacherId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_teacherId" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "teachers" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "TeacherStatus"`);
  }
}
