import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';
import { Permission } from './enums/permission.enum';
import { AuthorizationService } from './services/authorization.service';
import { Membership } from '../memberships/entities/membership.entity';
import { UsersService } from '../users/users.service';

const TEST_SECRET = 'test-secret';

@Controller('protected')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class TestController {
  @Get()
  @Permissions(Permission.STUDENTS_CREATE)
  createStudent() {
    return 'ok';
  }

  @Get('open')
  open() {
    return 'ok';
  }
}

describe('Authorization HTTP flow (401 / 403 / 200)', () => {
  let app: INestApplication;
  let authorizationService: { hasPermission: jest.Mock };

  beforeEach(async () => {
    authorizationService = { hasPermission: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: TEST_SECRET }),
      ],
      controllers: [TestController],
      providers: [
        JwtStrategy,
        PermissionsGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(TEST_SECRET) },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: 'user@example.com',
              status: 'ACTIVE',
            }),
          },
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'membership-1',
              roleId: 'role-1',
              status: 'ACTIVE',
            }),
          },
        },
        {
          provide: AuthorizationService,
          useValue: authorizationService,
        },
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 Unauthorized when no token is provided', async () => {
    const res = await request(app.getHttpServer()).get('/protected');

    expect(res.status).toBe(401);
  });

  it('returns 401 Unauthorized when the token is invalid', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-valid-token');

    expect(res.status).toBe(401);
  });

  it('returns 403 Forbidden when the authenticated user lacks the permission', async () => {
    authorizationService.hasPermission.mockResolvedValue(false);
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: 'user-1',
      email: 'user@example.com',
      organizationId: 'org-1',
    });

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(authorizationService.hasPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      Permission.STUDENTS_CREATE,
    );
  });

  it('returns 200 when the authenticated user has the permission', async () => {
    authorizationService.hasPermission.mockResolvedValue(true);
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: 'user-1',
      email: 'user@example.com',
      organizationId: 'org-1',
    });

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('returns 200 on a route without @Permissions for an authenticated user', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: 'user-1',
      email: 'user@example.com',
      organizationId: 'org-1',
    });

    const res = await request(app.getHttpServer())
      .get('/protected/open')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(authorizationService.hasPermission).not.toHaveBeenCalled();
  });
});
