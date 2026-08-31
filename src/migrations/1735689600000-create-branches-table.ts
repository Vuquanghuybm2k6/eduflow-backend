import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBranchesTable1735689600000 implements MigrationInterface {
  name = 'CreateBranchesTable1735689600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "BranchStatus" AS ENUM ('active', 'inactive')`,
    );

    await queryRunner.query(
      `CREATE TABLE "branches" (
        "id" text NOT NULL,
        "organizationId" text NOT NULL,
        "name" text NOT NULL,
        "code" text NOT NULL,
        "address" text,
        "phone" text,
        "status" "BranchStatus" NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
        CONSTRAINT "PK_branches" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_branches_organizationId" ON "branches" ("organizationId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_branches_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "FK_branches_organization"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_branches_organizationId"`);
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(`DROP TYPE "BranchStatus"`);
  }
}
