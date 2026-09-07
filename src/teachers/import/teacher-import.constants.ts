export const TEACHER_IMPORT_HEADERS: readonly string[] = [
  'email',
  'full_name',
  'teacher_code',
  'specialization',
  'qualification',
  'bio',
  'hire_date',
  'branch_codes',
];

export const TEACHER_IMPORT_HEADER_LABELS: Record<string, string> = {
  email: 'Email',
  full_name: 'Họ và tên',
  teacher_code: 'Mã giáo viên',
  specialization: 'Chuyên môn',
  qualification: 'Bằng cấp',
  bio: 'Giới thiệu',
  hire_date: 'Ngày tuyển dụng',
  branch_codes: 'Mã chi nhánh',
};

export const TEACHER_IMPORT_WORKSHEET_NAME = 'Teachers';

export const TEACHER_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const TEACHER_IMPORT_MAX_ROWS = 5000;

export const TEACHER_IMPORT_MAX_FULL_NAME_LENGTH = 150;

export const TEACHER_IMPORT_MAX_TEACHER_CODE_LENGTH = 50;

export const TEACHER_IMPORT_MAX_SPECIALIZATION_LENGTH = 100;

export const TEACHER_IMPORT_MAX_QUALIFICATION_LENGTH = 100;

export const TEACHER_IMPORT_MAX_BIO_LENGTH = 2000;

export const TEACHER_IMPORT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEACHER_IMPORT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
