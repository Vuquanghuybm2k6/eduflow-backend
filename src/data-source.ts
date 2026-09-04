import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

import { UuidValueGeneratorSubscriber } from './common/subscribers/uuid-value-generator.subscriber';
import { User } from './users/entities/user.entity';
import { Organization } from './organizations/entities/organization.entity';
import { Role } from './roles/entities/role.entity';
import { RolePermission } from './roles/entities/role-permission.entity';
import { Permission } from './permissions/entities/permission.entity';
import { Membership } from './memberships/entities/membership.entity';
import { Branch } from './branches/entities/branch.entity';
import { Course } from './courses/entities/course.entity';
import { Class } from './classes/entities/class.entity';
import { Teacher } from './teachers/entities/teacher.entity';
import { Student } from './students/entities/student.entity';
import { Enrollment } from './enrollments/entities/enrollment.entity';
import { Schedule } from './schedules/entities/schedule.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { VerificationToken } from './auth/entities/verification-token.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Organization,
    Role,
    RolePermission,
    Permission,
    Membership,
    Branch,
    Course,
    Class,
    Teacher,
    Student,
    Enrollment,
    Schedule,
    RefreshToken,
    VerificationToken,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [UuidValueGeneratorSubscriber],
  synchronize: false,
});
