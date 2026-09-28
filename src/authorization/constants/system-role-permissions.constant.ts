import { Permission } from '../enums/permission.enum';
import { RoleCode } from '../enums/role.enum';

export interface PermissionSeed {
  code: Permission;
  name: string;
  description: string;
}

export interface SystemRoleSeed {
  code: RoleCode;
  name: string;
  description: string;
  permissions: Permission[];
}

export const PERMISSION_SEEDS: PermissionSeed[] = [
  {
    code: Permission.STUDENTS_READ,
    name: 'Read students',
    description: 'View students in the organization',
  },
  {
    code: Permission.STUDENTS_CREATE,
    name: 'Create students',
    description: 'Create new students in the organization',
  },
  {
    code: Permission.STUDENTS_UPDATE,
    name: 'Update students',
    description: 'Update students in the organization',
  },
  {
    code: Permission.STUDENTS_DELETE,
    name: 'Delete students',
    description: 'Delete students in the organization',
  },
  {
    code: Permission.TEACHERS_READ,
    name: 'Read teachers',
    description: 'View teachers in the organization',
  },
  {
    code: Permission.TEACHERS_CREATE,
    name: 'Create teachers',
    description: 'Create new teachers in the organization',
  },
  {
    code: Permission.TEACHERS_UPDATE,
    name: 'Update teachers',
    description: 'Update teachers in the organization',
  },
  {
    code: Permission.TEACHERS_DELETE,
    name: 'Delete teachers',
    description: 'Delete teachers in the organization',
  },
  {
    code: Permission.BRANCHES_READ,
    name: 'Read branches',
    description: 'View branches in the organization',
  },
  {
    code: Permission.BRANCHES_CREATE,
    name: 'Create branches',
    description: 'Create new branches in the organization',
  },
  {
    code: Permission.BRANCHES_UPDATE,
    name: 'Update branches',
    description: 'Update branches in the organization',
  },
  {
    code: Permission.BRANCHES_DELETE,
    name: 'Delete branches',
    description: 'Delete branches in the organization',
  },
  {
    code: Permission.COURSES_READ,
    name: 'Read courses',
    description: 'View courses in the organization',
  },
  {
    code: Permission.COURSES_CREATE,
    name: 'Create courses',
    description: 'Create new courses in the organization',
  },
  {
    code: Permission.COURSES_UPDATE,
    name: 'Update courses',
    description: 'Update courses in the organization',
  },
  {
    code: Permission.COURSES_DELETE,
    name: 'Delete courses',
    description: 'Delete courses in the organization',
  },
  {
    code: Permission.CLASSES_READ,
    name: 'Read classes',
    description: 'View classes in the organization',
  },
  {
    code: Permission.CLASSES_CREATE,
    name: 'Create classes',
    description: 'Create new classes in the organization',
  },
  {
    code: Permission.CLASSES_UPDATE,
    name: 'Update classes',
    description: 'Update classes in the organization',
  },
  {
    code: Permission.CLASSES_DELETE,
    name: 'Delete classes',
    description: 'Delete classes in the organization',
  },
  {
    code: Permission.ENROLLMENTS_READ,
    name: 'Read enrollments',
    description: 'View enrollments in the organization',
  },
  {
    code: Permission.ENROLLMENTS_CREATE,
    name: 'Create enrollments',
    description: 'Create new enrollments in the organization',
  },
  {
    code: Permission.ENROLLMENTS_UPDATE,
    name: 'Update enrollments',
    description: 'Update enrollments in the organization',
  },
  {
    code: Permission.SCHEDULES_READ,
    name: 'Read schedules',
    description: 'View schedules in the organization',
  },
  {
    code: Permission.SCHEDULES_CREATE,
    name: 'Create schedules',
    description: 'Create new schedules in the organization',
  },
  {
    code: Permission.SCHEDULES_UPDATE,
    name: 'Update schedules',
    description: 'Update schedules in the organization',
  },
  {
    code: Permission.SCHEDULES_DELETE,
    name: 'Delete schedules',
    description: 'Delete schedules in the organization',
  },
  {
    code: Permission.ATTENDANCE_READ,
    name: 'Read attendance',
    description: 'View attendance records',
  },
  {
    code: Permission.ATTENDANCE_UPDATE,
    name: 'Update attendance',
    description: 'Record and update attendance',
  },
  {
    code: Permission.REPORTS_READ,
    name: 'Read reports',
    description: 'View analytics and reports',
  },
];

const OWNER_PERMISSIONS: Permission[] = [
  Permission.STUDENTS_READ,
  Permission.STUDENTS_CREATE,
  Permission.STUDENTS_UPDATE,
  Permission.STUDENTS_DELETE,
  Permission.TEACHERS_READ,
  Permission.TEACHERS_CREATE,
  Permission.TEACHERS_UPDATE,
  Permission.TEACHERS_DELETE,
  Permission.BRANCHES_READ,
  Permission.BRANCHES_CREATE,
  Permission.BRANCHES_UPDATE,
  Permission.BRANCHES_DELETE,
  Permission.COURSES_READ,
  Permission.COURSES_CREATE,
  Permission.COURSES_UPDATE,
  Permission.COURSES_DELETE,
  Permission.CLASSES_READ,
  Permission.CLASSES_CREATE,
  Permission.CLASSES_UPDATE,
  Permission.CLASSES_DELETE,
  Permission.ENROLLMENTS_READ,
  Permission.ENROLLMENTS_CREATE,
  Permission.ENROLLMENTS_UPDATE,
  Permission.SCHEDULES_READ,
  Permission.SCHEDULES_CREATE,
  Permission.SCHEDULES_UPDATE,
  Permission.SCHEDULES_DELETE,
  Permission.ATTENDANCE_READ,
  Permission.REPORTS_READ,
];

const ADMIN_PERMISSIONS: Permission[] = [
  Permission.STUDENTS_READ,
  Permission.STUDENTS_CREATE,
  Permission.STUDENTS_UPDATE,
  Permission.STUDENTS_DELETE,
  Permission.TEACHERS_READ,
  Permission.TEACHERS_CREATE,
  Permission.TEACHERS_UPDATE,
  Permission.TEACHERS_DELETE,
  Permission.BRANCHES_READ,
  Permission.BRANCHES_CREATE,
  Permission.BRANCHES_UPDATE,
  Permission.BRANCHES_DELETE,
  Permission.COURSES_READ,
  Permission.COURSES_CREATE,
  Permission.COURSES_UPDATE,
  Permission.COURSES_DELETE,
  Permission.CLASSES_READ,
  Permission.CLASSES_CREATE,
  Permission.CLASSES_UPDATE,
  Permission.CLASSES_DELETE,
  Permission.ENROLLMENTS_READ,
  Permission.ENROLLMENTS_CREATE,
  Permission.ENROLLMENTS_UPDATE,
  Permission.SCHEDULES_READ,
  Permission.SCHEDULES_CREATE,
  Permission.SCHEDULES_UPDATE,
  Permission.SCHEDULES_DELETE,
  Permission.ATTENDANCE_READ,
  Permission.REPORTS_READ,
];

const TEACHER_PERMISSIONS: Permission[] = [
  Permission.STUDENTS_READ,
  Permission.TEACHERS_READ,
  Permission.CLASSES_READ,
  Permission.SCHEDULES_READ,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_UPDATE,
  Permission.REPORTS_READ,
];

const STUDENT_PERMISSIONS: Permission[] = [
  Permission.CLASSES_READ,
  Permission.SCHEDULES_READ,
];

export const SYSTEM_ROLES: SystemRoleSeed[] = [
  {
    code: RoleCode.OWNER,
    name: 'Owner',
    description: 'Organization owner with full resource management access',
    permissions: OWNER_PERMISSIONS,
  },
  {
    code: RoleCode.ADMIN,
    name: 'Admin',
    description: 'Organization administrator with resource management access',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    code: RoleCode.TEACHER,
    name: 'Teacher',
    description: 'Teacher who can view students, classes and manage attendance',
    permissions: TEACHER_PERMISSIONS,
  },
  {
    code: RoleCode.STUDENT,
    name: 'Student',
    description: 'Student with read-only access to classes and schedules',
    permissions: STUDENT_PERMISSIONS,
  },
];
