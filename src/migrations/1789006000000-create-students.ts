import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStudents1789006000000 implements MigrationInterface {
  name = 'CreateStudents1789006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE', 'OTHER')`,
    );

    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" text NOT NULL,
        "userId" text NOT NULL,
        "organizationId" text NOT NULL,
        "studentCode" text NOT NULL,
        "dateOfBirth" date,
        "gender" "StudentGender",
        "address" text,
        "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_students" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_students_userId" ON "students" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_students_organizationId" ON "students" ("organizationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "UQ_students_userId" UNIQUE ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "UQ_students_organizationId_studentCode" UNIQUE ("organizationId", "studentCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_students_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_students_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE "student_branches" (
        "studentId" text NOT NULL,
        "branchId" text NOT NULL,
        CONSTRAINT "UQ_student_branches" UNIQUE ("studentId", "branchId"),
        CONSTRAINT "FK_student_branches_studentId" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_student_branches_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_student_branches_studentId" ON "student_branches" ("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_student_branches_branchId" ON "student_branches" ("branchId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_branches" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "students" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "StudentGender"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "StudentStatus"`);
  }
}
