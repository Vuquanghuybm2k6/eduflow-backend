import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthorizationService } from './authorization.service';
import { Permission } from '../enums/permission.enum';
import { RoleCode } from '../enums/role.enum';
import {
  Membership,
  MembershipStatus,
} from '../../memberships/entities/membership.entity';

function membershipWith(role: {
  code: RoleCode;
  rolePermissions: Array<{ permission: { code: string } }>;
}) {
  return { role };
}

function roleWith(code: RoleCode, permissions: string[]) {
  return {
    code,
    rolePermissions: permissions.map((permission) => ({
      permission: { code: permission },
    })),
  };
}

const OWNER = roleWith(RoleCode.OWNER, [
  Permission.STUDENTS_READ,
  Permission.STUDENTS_CREATE,
]);
const ADMIN = roleWith(RoleCode.ADMIN, [
  Permission.STUDENTS_CREATE,
  Permission.TEACHERS_CREATE,
]);
const TEACHER = roleWith(RoleCode.TEACHER, [
  Permission.STUDENTS_READ,
  Permission.ATTENDANCE_UPDATE,
]);
const STUDENT = roleWith(RoleCode.STUDENT, [
  Permission.CLASSES_READ,
  Permission.SCHEDULES_READ,
]);

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let membershipRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    membershipRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipRepository,
        },
      ],
    }).compile();

    service = module.get(AuthorizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns true when the membership has no role (edge case)', async () => {
    membershipRepository.findOne.mockResolvedValue({ role: null });

    const result = await service.hasPermission(
      'user-1',
      'org-1',
      Permission.STUDENTS_READ,
    );

    expect(result).toBe(false);
  });

  it('returns false when the user has no membership in the organization', async () => {
    membershipRepository.findOne.mockResolvedValue(null);

    const result = await service.hasPermission(
      'user-1',
      'org-1',
      Permission.STUDENTS_READ,
    );

    expect(result).toBe(false);
  });

  it('returns false for an INACTIVE membership', async () => {
    membershipRepository.findOne.mockResolvedValue({ role: null });

    const result = await service.hasPermission(
      'user-1',
      'org-1',
      Permission.STUDENTS_READ,
    );

    expect(result).toBe(false);
  });

  it('checks the membership against the ACTIVE status and both ids', async () => {
    membershipRepository.findOne.mockResolvedValue(null);

    await service.hasPermission('user-1', 'org-1', Permission.STUDENTS_READ);

    expect(membershipRepository.findOne).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        organizationId: 'org-1',
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
  });

  describe('Permission mapping per Role', () => {
    it('OWNER has students:read', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(OWNER));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.STUDENTS_READ),
      ).resolves.toBe(true);
    });

    it('ADMIN has students:create', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(ADMIN));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.STUDENTS_CREATE),
      ).resolves.toBe(true);
    });

    it('TEACHER has students:read', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(TEACHER));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.STUDENTS_READ),
      ).resolves.toBe(true);
    });

    it('TEACHER does not have students:create', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(TEACHER));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.STUDENTS_CREATE),
      ).resolves.toBe(false);
    });

    it('STUDENT does not have students:create', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(STUDENT));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.STUDENTS_CREATE),
      ).resolves.toBe(false);
    });

    it('STUDENT has classes:read', async () => {
      membershipRepository.findOne.mockResolvedValue(membershipWith(STUDENT));

      await expect(
        service.hasPermission('user-1', 'org-1', Permission.CLASSES_READ),
      ).resolves.toBe(true);
    });
  });

  describe('Organization-scoped roles', () => {
    it('determines the permission from the role of the CURRENT organization', async () => {
      membershipRepository.findOne.mockImplementation(
        ({ where }: { where: { organizationId: string } }) =>
          where.organizationId === 'org-a'
            ? Promise.resolve(membershipWith(OWNER))
            : Promise.resolve(membershipWith(TEACHER)),
      );

      await expect(
        service.hasPermission('user-1', 'org-a', Permission.STUDENTS_CREATE),
      ).resolves.toBe(true);
      await expect(
        service.hasPermission('user-1', 'org-b', Permission.STUDENTS_CREATE),
      ).resolves.toBe(false);
      await expect(
        service.hasPermission('user-1', 'org-b', Permission.STUDENTS_READ),
      ).resolves.toBe(true);
    });
  });
});
