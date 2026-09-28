import { ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function createContext(): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function createGuard(isPublic: boolean | undefined) {
  const getAllAndOverride = jest.fn().mockReturnValue(isPublic);
  const guard = new JwtAuthGuard({ getAllAndOverride } as never);

  return { guard, getAllAndOverride };
}

describe('JwtAuthGuard', () => {
  it('allows the request through when the route is marked @Public()', () => {
    const { guard } = createGuard(true);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('reads the @Public() metadata from the handler and the class', () => {
    const { guard, getAllAndOverride } = createGuard(true);

    void guard.canActivate(createContext());

    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });
});
