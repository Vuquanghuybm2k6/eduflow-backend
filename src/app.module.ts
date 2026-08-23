import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesModule } from './roles/roles.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [UsersModule, OrganizationsModule, RolesModule, MembershipsModule, PermissionsModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
