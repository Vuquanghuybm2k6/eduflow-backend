import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/entities/membership.entity';
import { AuthorizationService } from './services/authorization.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  providers: [AuthorizationService, PermissionsGuard],
  exports: [AuthorizationService, PermissionsGuard],
})
export class AuthorizationModule {}
