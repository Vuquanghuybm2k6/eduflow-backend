import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthorizationService } from '../services/authorization.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    for (const permission of requiredPermissions) {
      const allowed = await this.authorizationService.hasPermission(
        user.userId,
        user.organizationId,
        permission,
      );

      if (!allowed) {
        throw new ForbiddenException(
          `Missing required permission: ${permission}`,
        );
      }
    }

    return true;
  }
}
