import { ForbiddenException } from '@nestjs/common';
import { resolveCurrentOrganization } from './current-organization.decorator';

describe('CurrentOrganization', () => {
  describe('resolveCurrentOrganization', () => {
    it('returns organizationId from request.user (JWT context)', () => {
      const organizationId = resolveCurrentOrganization({
        user: { organizationId: 'org-b' },
      } as never);

      expect(organizationId).toBe('org-b');
    });

    it('falls back to request.organizationId when user has none', () => {
      const organizationId = resolveCurrentOrganization({
        user: {},
        organizationId: 'org-a',
      } as never);

      expect(organizationId).toBe('org-a');
    });

    it('throws ForbiddenException when no organization is present', () => {
      expect(() =>
        resolveCurrentOrganization({ user: { userId: 'user-1' } } as never),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException on an unauthenticated request', () => {
      expect(() => resolveCurrentOrganization({} as never)).toThrow(
        ForbiddenException,
      );
    });
  });
});
