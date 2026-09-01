import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherBranches1789005000000 implements MigrationInterface {
  name = 'CreateTeacherBranches1789005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teacher_branches" (
        "teacherId" text NOT NULL,
        "branchId" text NOT NULL,
        CONSTRAINT "UQ_teacher_branches" UNIQUE ("teacherId", "branchId"),
        CONSTRAINT "FK_teacher_branches_teacherId" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_teacher_branches_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_teacher_branches_teacherId" ON "teacher_branches" ("teacherId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_teacher_branches_branchId" ON "teacher_branches" ("branchId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_branches" CASCADE`);
  }
}