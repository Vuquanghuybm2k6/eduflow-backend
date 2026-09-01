import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClasses1789003000000 implements MigrationInterface {
  name = 'CreateClasses1789003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ClassStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "branchId" text NOT NULL,
        "courseId" text NOT NULL,
        "name" text NOT NULL,
        "code" text NOT NULL,
        "teacherId" text,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "capacity" integer NOT NULL,
        "status" "ClassStatus" NOT NULL DEFAULT 'UPCOMING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_classes" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_classes_organizationId" ON "classes" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classes_branchId" ON "classes" ("branchId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classes_courseId" ON "classes" ("courseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_classes_teacherId" ON "classes" ("teacherId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "UQ_classes_organizationId_code" UNIQUE ("organizationId", "code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_courseId" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ADD CONSTRAINT "FK_classes_teacherId" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "classes" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ClassStatus"`);
  }
}