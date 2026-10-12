import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CurrentOrganizationRequest } from '../../auth/decorators/current-organization.decorator';

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<CurrentOrganizationRequest>();

    // 1. JWT has already been validated by JwtAuthGuard
    // 2. Extract organizationId from request.user (Single Source of Truth)
    const organizationId = request.user?.organizationId;

    if (!organizationId) {
      throw new ForbiddenException(
        'No current organization found in authenticated session',
      );
    }

    // 3. Attach to request for easy access in Controllers and Services
    request.organizationId = organizationId;

    return true;
  }
}
