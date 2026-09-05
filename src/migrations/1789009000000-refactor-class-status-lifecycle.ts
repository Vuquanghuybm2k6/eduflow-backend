import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorClassStatusLifecycle1789009000000 implements MigrationInterface {
  name = 'RefactorClassStatusLifecycle1789009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ClassLifecycleStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED')`,
    );

    await queryRunner.query(
      `ALTER TYPE "ClassStatus" RENAME TO "ClassStatus_legacy"`,
    );
    await queryRunner.query(
      `CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" ADD COLUMN "lifecycle_status" "ClassLifecycleStatus"`,
    );
    await queryRunner.query(`
      UPDATE "classes"
      SET "lifecycle_status" = CASE "status"::text
        WHEN 'UPCOMING'  THEN 'UPCOMING'::"ClassLifecycleStatus"
        WHEN 'ACTIVE'    THEN 'ONGOING'::"ClassLifecycleStatus"
        WHEN 'COMPLETED' THEN 'COMPLETED'::"ClassLifecycleStatus"
        WHEN 'CANCELLED' THEN 'CANCELLED'::"ClassLifecycleStatus"
        ELSE 'UPCOMING'::"ClassLifecycleStatus"
      END
    `);
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "lifecycle_status" SET DEFAULT 'UPCOMING'::"ClassLifecycleStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "lifecycle_status" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "status" TYPE "ClassStatus" USING 'ACTIVE'::"ClassStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"ClassStatus"`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "name" TYPE varchar(150)`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "code" TYPE varchar(50)`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "organizationId" TO "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "branchId" TO "branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "courseId" TO "course_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "teacherId" TO "teacher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "startDate" TO "start_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "endDate" TO "end_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "createdAt" TO "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "updatedAt" TO "updated_at"`,
    );

    await queryRunner.query(
      `ALTER INDEX "IDX_classes_organizationId" RENAME TO "IDX_classes_organization_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_branchId" RENAME TO "IDX_classes_branch_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_courseId" RENAME TO "IDX_classes_course_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_teacherId" RENAME TO "IDX_classes_teacher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_organizationId" TO "FK_classes_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_branchId" TO "FK_classes_branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_courseId" TO "FK_classes_course_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_teacherId" TO "FK_classes_teacher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "UQ_classes_organizationId_code" TO "UQ_classes_organization_id_code"`,
    );

    await queryRunner.query(`DROP TYPE "ClassStatus_legacy"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "name" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "code" TYPE text`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "UQ_classes_organization_id_code" TO "UQ_classes_organizationId_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_teacher_id" TO "FK_classes_teacherId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_course_id" TO "FK_classes_courseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_branch_id" TO "FK_classes_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME CONSTRAINT "FK_classes_organization_id" TO "FK_classes_organizationId"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_teacher_id" RENAME TO "IDX_classes_teacherId"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_course_id" RENAME TO "IDX_classes_courseId"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_branch_id" RENAME TO "IDX_classes_branchId"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_classes_organization_id" RENAME TO "IDX_classes_organizationId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "updated_at" TO "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "created_at" TO "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "end_date" TO "endDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "start_date" TO "startDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "teacher_id" TO "teacherId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "course_id" TO "courseId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "branch_id" TO "branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" RENAME COLUMN "organization_id" TO "organizationId"`,
    );

    await queryRunner.query(
      `ALTER TYPE "ClassStatus" RENAME TO "ClassStatus_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "ClassStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "classes"
      ALTER COLUMN "status" TYPE "ClassStatus"
      USING CASE "lifecycle_status"::text
        WHEN 'UPCOMING'  THEN 'UPCOMING'::"ClassStatus"
        WHEN 'ONGOING'   THEN 'ACTIVE'::"ClassStatus"
        WHEN 'COMPLETED' THEN 'COMPLETED'::"ClassStatus"
        WHEN 'CANCELLED' THEN 'CANCELLED'::"ClassStatus"
        ELSE 'UPCOMING'::"ClassStatus"
      END
    `);
    await queryRunner.query(
      `ALTER TABLE "classes" ALTER COLUMN "status" SET DEFAULT 'UPCOMING'::"ClassStatus"`,
    );

    await queryRunner.query(
      `ALTER TABLE "classes" DROP COLUMN "lifecycle_status"`,
    );

    await queryRunner.query(`DROP TYPE "ClassStatus_new"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ClassLifecycleStatus"`);
  }
}
