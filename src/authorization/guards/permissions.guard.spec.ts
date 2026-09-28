import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../enums/permission.enum';

function makeContext(
  user: unknown,
  handler: () => void = () => undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function setPermissions(handler: () => void, permissions: string[]): void {
  Reflect.defineMetadata(PERMISSIONS_KEY, permissions, handler);
}

describe('PermissionsGuard', () => {
  let authService: { hasPermission: jest.Mock };
  let reflector: Reflector;

  const buildGuard = async (context: ExecutionContext) => {
    const guard = new PermissionsGuard(reflector, authService as never);
    return guard.canActivate(context);
  };

  beforeEach(() => {
    authService = { hasPermission: jest.fn() };
    reflector = new Reflector();
  });

  it('allows the request when no @Permissions metadata is present', async () => {
    const context = makeContext({ userId: 'user-1', organizationId: 'org-1' });

    await expect(buildGuard(context)).resolves.toBe(true);
    expect(authService.hasPermission).not.toHaveBeenCalled();
  });

  it('allows the request when the user has the required permission', async () => {
    authService.hasPermission.mockResolvedValue(true);
    const handler = () => undefined;
    setPermissions(handler, [Permission.STUDENTS_CREATE]);
    const context = makeContext(
      { userId: 'user-1', organizationId: 'org-1' },
      handler,
    );

    await expect(buildGuard(context)).resolves.toBe(true);
    expect(authService.hasPermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      Permission.STUDENTS_CREATE,
    );
  });

  it('throws ForbiddenException when the user lacks the required permission', async () => {
    authService.hasPermission.mockResolvedValue(false);
    const handler = () => undefined;
    setPermissions(handler, [Permission.STUDENTS_CREATE]);
    const context = makeContext(
      { userId: 'user-1', organizationId: 'org-1' },
      handler,
    );

    await expect(buildGuard(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when not every required permission is granted', async () => {
    authService.hasPermission.mockImplementation(
      (permission: string) =>
        permission === (Permission.STUDENTS_READ as string),
    );
    const handler = () => undefined;
    setPermissions(handler, [
      Permission.STUDENTS_READ,
      Permission.STUDENTS_UPDATE,
    ]);
    const context = makeContext(
      { userId: 'user-1', organizationId: 'org-1' },
      handler,
    );

    await expect(buildGuard(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when the request carries no user', async () => {
    authService.hasPermission.mockResolvedValue(true);
    const handler = () => undefined;
    setPermissions(handler, [Permission.STUDENTS_READ]);
    const context = makeContext(undefined, handler);

    await expect(buildGuard(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reads metadata defined on the controller class as a fallback', async () => {
    authService.hasPermission.mockResolvedValue(true);
    class TestController {}
    Reflect.defineMetadata(
      PERMISSIONS_KEY,
      [Permission.REPORTS_READ],
      TestController,
    );
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'u1', organizationId: 'o1' } }),
      }),
      getHandler: () => () => undefined,
      getClass: () => TestController,
    } as unknown as ExecutionContext;

    await expect(buildGuard(context)).resolves.toBe(true);
    expect(authService.hasPermission).toHaveBeenCalledWith(
      'u1',
      'o1',
      Permission.REPORTS_READ,
    );
  });
});
