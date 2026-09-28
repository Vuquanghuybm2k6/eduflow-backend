import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Membership,
  MembershipStatus,
} from '../../memberships/entities/membership.entity';

export interface PermissionCheckResult {
  allowed: boolean;
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
    const membership = await this.membershipRepository.findOne({
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

    if (!membership?.role) {
      return false;
    }

    return membership.role.rolePermissions.some(
      (rolePermission) =>
        rolePermission.permission?.code != null &&
        String(rolePermission.permission.code) === permission,
    );
  }
}
