import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentOrganizationRequest extends Request {
  user?: { organizationId?: string };
  organizationId?: string;
}

export function resolveCurrentOrganization(
  request: CurrentOrganizationRequest,
): string {
  const organizationId = request.organizationId;

  if (!organizationId) {
    throw new ForbiddenException('No current organization for this request');
  }

  return organizationId;
}

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    resolveCurrentOrganization(
      ctx.switchToHttp().getRequest<CurrentOrganizationRequest>(),
    ),
);
