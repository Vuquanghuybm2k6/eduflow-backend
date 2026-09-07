import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImportJobs1789010000000 implements MigrationInterface {
  name = 'CreateImportJobs1789010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ImportJobStatus" AS ENUM ('PREVIEW','CONFIRMED','PROCESSING','COMPLETED','FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "ImportJobRowStatus" AS ENUM ('PENDING','SUCCESS','FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "import_jobs" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "entityType" text NOT NULL,
        "fileName" text NOT NULL,
        "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEW',
        "totalRows" integer NOT NULL DEFAULT 0,
        "successRows" integer NOT NULL DEFAULT 0,
        "failedRows" integer NOT NULL DEFAULT 0,
        "createdBy" text NOT NULL,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_import_jobs_organizationId" ON "import_jobs" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_import_jobs_createdBy" ON "import_jobs" ("createdBy")`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_jobs" ADD CONSTRAINT "FK_import_jobs_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "import_job_rows" (
        "id" text NOT NULL,
        "importJobId" text NOT NULL,
        "rowNumber" integer NOT NULL,
        "rawData" jsonb NOT NULL DEFAULT '{}',
        "normalizedData" jsonb NOT NULL DEFAULT '{}',
        "status" "ImportJobRowStatus" NOT NULL DEFAULT 'PENDING',
        "errors" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_job_rows" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_import_job_rows_importJobId" ON "import_job_rows" ("importJobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_import_job_rows_importJobId_rowNumber" ON "import_job_rows" ("importJobId", "rowNumber")`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job_rows" ADD CONSTRAINT "FK_import_job_rows_importJobId" FOREIGN KEY ("importJobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "import_job_rows" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_jobs" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ImportJobRowStatus"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ImportJobStatus"`);
  }
}
