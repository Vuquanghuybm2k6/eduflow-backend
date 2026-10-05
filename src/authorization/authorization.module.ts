import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthorizationService } from './services/authorization.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { OrganizationContextGuard } from './guards/organization-context.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  providers: [
    AuthorizationService,
    // Order matters:
    // 1. JwtAuthGuard: Validates token and sets request.user
    // 2. OrganizationContextGuard: Extracts orgId from request.user and sets request.organizationId
    // 3. PermissionsGuard: Checks permissions using request.user and request.organizationId
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OrganizationContextGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
