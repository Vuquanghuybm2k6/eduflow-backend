import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { Membership } from '../memberships/entities/membership.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthorizationModule } from './authorization.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthorizationService } from './services/authorization.service';

interface GuardProvider {
  provide: unknown;
  useClass: unknown;
}

describe('AuthorizationModule global guard registration', () => {
  const providers = Reflect.getMetadata(
    'providers',
    AuthorizationModule,
  ) as unknown[];
  const globalGuards = providers.filter(
    (provider): provider is GuardProvider =>
      typeof provider === 'object' &&
      provider !== null &&
      'provide' in provider &&
      (provider as GuardProvider).provide === APP_GUARD,
  );

  it('registers both guards as global guards', () => {
    expect(globalGuards).toHaveLength(2);
  });

  it('registers JwtAuthGuard before PermissionsGuard', () => {
    // Order is behavioural, not cosmetic: JwtAuthGuard must run first so an
    // unauthenticated request gets 401 instead of PermissionsGuard failing on
    // a missing request.user and returning 403.
    expect(globalGuards[0].useClass).toBe(JwtAuthGuard);
    expect(globalGuards[1].useClass).toBe(PermissionsGuard);
  });

  it('compiles the module so the DI graph is valid at bootstrap', async () => {
    // Guards registered through APP_GUARD are not module providers by class, so
    // exporting them fails only while Nest scans the graph. Unit tests that
    // never build the module cannot catch that, so build it here.
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationModule],
    })
      .overrideProvider(getRepositoryToken(Membership))
      .useValue({ findOne: jest.fn() })
      .compile();

    expect(moduleRef.get(AuthorizationService)).toBeInstanceOf(
      AuthorizationService,
    );

    await moduleRef.close();
  });
});
