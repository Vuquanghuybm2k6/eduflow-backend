import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { user?: Record<string, unknown> };

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
