import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RefreshTokensModule } from './refresh_tokens/refresh_tokens.module';
import { RolesModule } from './roles/roles.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolePermissionsModule } from './role_permissions/role_permissions.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [UsersModule, OrganizationsModule, RefreshTokensModule, RolesModule, MembershipsModule, PermissionsModule, RolePermissionsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
