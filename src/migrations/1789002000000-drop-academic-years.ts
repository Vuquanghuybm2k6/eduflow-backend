import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAcademicYears1789002000000 implements MigrationInterface {
  name = 'DropAcademicYears1789002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "academic_years" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "AcademicYearStatus"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "AcademicYearStatus" AS ENUM ('active', 'inactive', 'completed')`,
    );
    await queryRunner.query(`
      CREATE TABLE "academic_years" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "name" text NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "status" "AcademicYearStatus" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_academic_years" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_years_organizationId" ON "academic_years" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" ADD CONSTRAINT "UQ_academic_years_organizationId_name" UNIQUE ("organizationId", "name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "academic_years" ADD CONSTRAINT "FK_academic_years_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }
}
