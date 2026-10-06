import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { Student } from '../students/entities/student.entity';
import { Membership } from '../memberships/entities/membership.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';

describe('CurrentOrganization Integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const ORG_A = '00000000-0000-4000-a000-000000000001';
  const ORG_B = '00000000-0000-4000-b000-000000000002';
  const USER_ID = '00000000-0000-4000-c000-000000000003';

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
    // Clean up
    await dataSource.getRepository(Student).delete({});
    await dataSource.getRepository(Membership).delete({});
    await dataSource.getRepository(Organization).delete({});
    await dataSource.getRepository(User).delete({});

    // Seed
    await dataSource.getRepository(Organization).save([
      { id: ORG_A, name: 'Org A' },
      { id: ORG_B, name: 'Org B' },
    ]);
    await dataSource
      .getRepository(User)
      .save([{ id: USER_ID, email: 'test@test.com', fullName: 'Test User' }]);

    await dataSource.getRepository(Membership).save([
      {
        userId: USER_ID,
        organizationId: ORG_A,
        role: { name: 'Admin' },
        status: 'ACTIVE',
      },
      {
        userId: USER_ID,
        organizationId: ORG_B,
        role: { name: 'Teacher' },
        status: 'ACTIVE',
      },
    ]);

    await dataSource.getRepository(Student).save([
      {
        id: 's1',
        organizationId: ORG_A,
        studentCode: 'S-A',
        user: { id: 'u1', email: 's1@a.com' },
      },
      {
        id: 's2',
        organizationId: ORG_B,
        studentCode: 'S-B',
        user: { id: 'u2', email: 's2@b.com' },
      },
    ]);
  });

  const getJwt = (orgId: string) => {
    return jwtService.sign({ userId: USER_ID, organizationId: orgId });
  };

  it('should scope data to the organization in JWT (Org B)', async () => {
    const token = getJwt(ORG_B);
    const res = await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Should only see student from Org B
    expect(res.body.length).toBe(1);
    expect(res.body[0].studentCode).toBe('S-B');
  });

  it('should ignore organizationId query parameter and stick to JWT org', async () => {
    const token = getJwt(ORG_B);
    const res = await request(app.getHttpServer())
      .get(`/students?organizationId=${ORG_A}`)
      .set('Authorization', `Bearer ${token}`);

    // If the API is correctly implemented, it either returns 400 (due to whitelist)
    // or it simply ignores the param and returns Org B data.
    if (res.status === 200) {
      expect(res.body[0].studentCode).toBe('S-B');
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('should apply permissions based on the organization in JWT', async () => {
    // User is Admin in Org A, Teacher in Org B
    // Action: Create Student (Requires ADMIN/OWNER)

    // 1. Try with Org B JWT (Teacher) -> Should be Forbidden
    const tokenB = getJwt(ORG_B);
    const resB = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        studentCode: 'S-NEW',
        email: 'new@b.com',
        fullName: 'New Student',
      });

    expect(resB.status).toBe(403);

    // 2. Try with Org A JWT (Admin) -> Should be OK
    const tokenA = getJwt(ORG_A);
    const resA = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        studentCode: 'S-NEW',
        email: 'new@a.com',
        fullName: 'New Student',
      });

    expect(resA.status).toBe(201);
  });
});
