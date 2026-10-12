import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Membership,
  MembershipStatus,
} from '../../memberships/entities/membership.entity';
import { RoleCode } from '../enums/role.enum';

export interface PermissionCheckResult {
  allowed: boolean;
}

export interface AuthorizationContext {
  role: { code: RoleCode | null; name: string } | null;
  permissions: string[];
}

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async hasPermission(
    userId: string,
    organizationId: string,
    permission: string,
  ): Promise<boolean> {
    const membership = await this.findActiveMembershipWithPermissions(
      userId,
      organizationId,
    );

    if (!membership?.role) {
      return false;
    }

    return membership.role.rolePermissions.some(
      (rolePermission) =>
        rolePermission.permission?.code != null &&
        String(rolePermission.permission.code) === permission,
    );
  }

  /**
   * Resolves the signed-in user's role and permission codes for the active
   * organization. Used to hydrate the frontend so it can gate its UI.
   */
  async getAuthorizationContext(
    userId: string,
    organizationId: string,
  ): Promise<AuthorizationContext> {
    const membership = await this.findActiveMembershipWithPermissions(
      userId,
      organizationId,
    );

    if (!membership?.role) {
      return { role: null, permissions: [] };
    }

    const permissions = Array.from(
      new Set(
        membership.role.rolePermissions
          .map((rolePermission) => rolePermission.permission?.code)
          .filter((code): code is NonNullable<typeof code> => code != null)
          .map((code) => String(code)),
      ),
    ).sort();

    return {
      role: { code: membership.role.code, name: membership.role.name },
      permissions,
    };
  }

  private async findActiveMembershipWithPermissions(
    userId: string,
    organizationId: string,
  ): Promise<Membership | null> {
    return this.membershipRepository.findOne({
      where: {
        userId,
        organizationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: {
        role: {
          rolePermissions: {
            permission: true,
          },
        },
      },
    });
  }
}
