import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../app.module';
import { Branch } from '../branches/entities/branch.entity';
import {
  Membership,
  MembershipStatus,
} from '../memberships/entities/membership.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Permission as PermissionEntity } from '../permissions/entities/permission.entity';
import { Role } from '../roles/entities/role.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { Student } from '../students/entities/student.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Permission } from './enums/permission.enum';
import { RoleCode } from './enums/role.enum';

const ORG_A = '00000000-0000-4000-a000-000000000001';
const ORG_B = '00000000-0000-4000-a000-000000000002';
const ADMIN_ID = '00000000-0000-4000-8000-000000000010';
const TEACHER_ID = '00000000-0000-4000-8000-000000000011';
const STUDENT_A_USER = '00000000-0000-4000-8000-000000000012';
const STUDENT_B_USER = '00000000-0000-4000-8000-000000000013';
const BRANCH_A = '00000000-0000-4000-8000-000000000020';

describe('CurrentOrganization Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await seed();
  });

  async function seed(): Promise<void> {
    await dataSource.query(
      `TRUNCATE TABLE "organizations", "users", "roles", "permissions" RESTART IDENTITY CASCADE`,
    );

    await dataSource.getRepository(PermissionEntity).save([
      { code: Permission.STUDENTS_READ, name: 'Read students' },
      { code: Permission.STUDENTS_CREATE, name: 'Create students' },
    ]);
    const permissionRepo = dataSource.getRepository(PermissionEntity);
    const readPermission = await permissionRepo.findOneByOrFail({
      code: Permission.STUDENTS_READ,
    });
    const createPermission = await permissionRepo.findOneByOrFail({
      code: Permission.STUDENTS_CREATE,
    });

    const roleRepo = dataSource.getRepository(Role);
    const adminRole = await roleRepo.save({
      code: RoleCode.ADMIN,
      name: 'Admin',
      organizationId: null,
      isSystem: true,
    });
    const teacherRole = await roleRepo.save({
      code: RoleCode.TEACHER,
      name: 'Teacher',
      organizationId: null,
      isSystem: true,
    });
    await roleRepo.save({
      code: RoleCode.STUDENT,
      name: 'Student',
      organizationId: null,
      isSystem: true,
    });

    await dataSource.getRepository(RolePermission).save([
      { roleId: adminRole.id, permissionId: readPermission.id },
      { roleId: adminRole.id, permissionId: createPermission.id },
      { roleId: teacherRole.id, permissionId: readPermission.id },
    ]);

    await dataSource.getRepository(Organization).save([
      { id: ORG_A, name: 'Org A', slug: 'org-a' },
      { id: ORG_B, name: 'Org B', slug: 'org-b' },
    ]);

    await dataSource.getRepository(User).save([
      {
        id: ADMIN_ID,
        email: 'admin@test.com',
        fullName: 'Admin User',
        status: UserStatus.ACTIVE,
      },
      {
        id: TEACHER_ID,
        email: 'teacher@test.com',
        fullName: 'Teacher User',
        status: UserStatus.ACTIVE,
      },
      {
        id: STUDENT_A_USER,
        email: 'student-a@test.com',
        fullName: 'Student A',
        status: UserStatus.ACTIVE,
      },
      {
        id: STUDENT_B_USER,
        email: 'student-b@test.com',
        fullName: 'Student B',
        status: UserStatus.ACTIVE,
      },
    ]);

    await dataSource.getRepository(Membership).save([
      {
        userId: ADMIN_ID,
        organizationId: ORG_A,
        roleId: adminRole.id,
        status: MembershipStatus.ACTIVE,
      },
      {
        userId: ADMIN_ID,
        organizationId: ORG_B,
        roleId: adminRole.id,
        status: MembershipStatus.ACTIVE,
      },
      {
        userId: TEACHER_ID,
        organizationId: ORG_B,
        roleId: teacherRole.id,
        status: MembershipStatus.ACTIVE,
      },
    ]);

    await dataSource.getRepository(Branch).save({
      id: BRANCH_A,
      organizationId: ORG_A,
      name: 'Main Campus',
      code: 'A-MAIN',
    });

    await dataSource.getRepository(Student).save([
      { organizationId: ORG_A, userId: STUDENT_A_USER, studentCode: 'S-A' },
      { organizationId: ORG_B, userId: STUDENT_B_USER, studentCode: 'S-B' },
    ]);
  }

  const tokenFor = (userId: string, organizationId: string, email: string) =>
    jwtService.sign({ sub: userId, email, organizationId });

  it('scopes data to the organization in the JWT (Org B)', async () => {
    const res = await request(app.getHttpServer())
      .get('/students')
      .set(
        'Authorization',
        `Bearer ${tokenFor(ADMIN_ID, ORG_B, 'admin@test.com')}`,
      );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].studentCode).toBe('S-B');
  });

  it('ignores the organizationId query parameter and sticks to the JWT org', async () => {
    const res = await request(app.getHttpServer())
      .get(`/students?organizationId=${ORG_A}`)
      .set(
        'Authorization',
        `Bearer ${tokenFor(ADMIN_ID, ORG_B, 'admin@test.com')}`,
      );

    if (res.status === 200) {
      expect(res.body).toHaveLength(1);
      expect(res.body[0].studentCode).toBe('S-B');
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('applies permissions based on the organization in the JWT', async () => {
    // The teacher is only a member of Org B and lacks students:create there.
    const forbidden = await request(app.getHttpServer())
      .post('/students')
      .set(
        'Authorization',
        `Bearer ${tokenFor(TEACHER_ID, ORG_B, 'teacher@test.com')}`,
      )
      .send({
        fullName: 'New Student',
        email: 'new-b@test.com',
        studentCode: 'S-NEW-B',
        branchIds: [BRANCH_A],
      });

    expect(forbidden.status).toBe(403);

    // The admin has students:create in Org A.
    const created = await request(app.getHttpServer())
      .post('/students')
      .set(
        'Authorization',
        `Bearer ${tokenFor(ADMIN_ID, ORG_A, 'admin@test.com')}`,
      )
      .send({
        fullName: 'New Student',
        email: 'new-a@test.com',
        studentCode: 'S-NEW-A',
        branchIds: [BRANCH_A],
      });

    expect(created.status).toBe(201);
  });

  it('exposes the current user role and permissions for the active org', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(
        'Authorization',
        `Bearer ${tokenFor(TEACHER_ID, ORG_B, 'teacher@test.com')}`,
      );

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TEACHER_ID);
    expect(res.body.organizationId).toBe(ORG_B);
    expect(res.body.role).toEqual({ code: RoleCode.TEACHER, name: 'Teacher' });
    expect(res.body.permissions).toEqual([Permission.STUDENTS_READ]);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('returns the full permission set sorted for an admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(
        'Authorization',
        `Bearer ${tokenFor(ADMIN_ID, ORG_A, 'admin@test.com')}`,
      );

    expect(res.status).toBe(200);
    expect(res.body.role).toEqual({ code: RoleCode.ADMIN, name: 'Admin' });
    expect(res.body.permissions).toEqual([
      Permission.STUDENTS_CREATE,
      Permission.STUDENTS_READ,
    ]);
  });
});
