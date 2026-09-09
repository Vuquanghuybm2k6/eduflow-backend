import type {
  ImportDefinition,
  ImportFieldDefinition,
} from '../../imports/definitions/import-field';

export const TEACHER_IMPORT_FIELDS: readonly ImportFieldDefinition[] = [
  {
    key: 'email',
    label: 'Email',
    aliases: ['E-mail', 'e-mail'],
    required: true,
    description: 'Email của giáo viên, phải kết thúc bằng @gmail.com',
    example: 'giaovien.template@gmail.com',
  },
  {
    key: 'full_name',
    label: 'Họ và tên',
    aliases: ['Full Name', 'full name', 'Full name'],
    required: true,
    description: 'Họ và tên đầy đủ của giáo viên',
    example: 'Nguyen Van B',
  },
  {
    key: 'teacher_code',
    label: 'Mã giáo viên',
    aliases: ['Teacher Code', 'Teacher code'],
    required: true,
    description: 'Mã giáo viên duy nhất trong tổ chức',
    example: 'GV001',
  },
  {
    key: 'specialization',
    label: 'Chuyên môn',
    aliases: ['Specialization', 'Subject'],
    required: false,
    description: 'Chuyên môn của giáo viên (không bắt buộc)',
    example: 'Toán',
  },
  {
    key: 'qualification',
    label: 'Bằng cấp',
    aliases: ['Qualification', 'Degree'],
    required: false,
    description: 'Bằng cấp của giáo viên (không bắt buộc)',
    example: 'Đại học',
  },
  {
    key: 'bio',
    label: 'Giới thiệu',
    aliases: ['Bio', 'Biography', 'Introduction'],
    required: false,
    description: 'Giới thiệu ngắn về giáo viên (không bắt buộc)',
    example: 'Giáo viên có 5 năm kinh nghiệm',
  },
  {
    key: 'hire_date',
    label: 'Ngày tuyển dụng',
    aliases: ['Hire Date', 'Hire date', 'Start Date', 'Start date'],
    required: false,
    description: 'Ngày tuyển dụng, định dạng YYYY-MM-DD',
    example: '2021-06-01',
  },
  {
    key: 'gender',
    label: 'Giới tính',
    aliases: ['Gender', 'Sex'],
    required: false,
    description:
      'Giới tính: MALE (Nam), FEMALE (Nữ) hoặc OTHER (Khác); cũng nhận Nam/Nữ/Khác',
    example: 'MALE',
  },
  {
    key: 'branch_codes',
    label: 'Mã chi nhánh',
    aliases: ['Branch Codes', 'Branch codes'],
    required: true,
    description: 'Danh sách mã chi nhánh, cách nhau bởi dấu phẩy',
    example: 'BR001,BR002',
  },
];

export const TEACHER_IMPORT_DEFINITION: ImportDefinition = {
  fields: TEACHER_IMPORT_FIELDS,
};

export const TEACHER_IMPORT_HEADERS: readonly string[] =
  TEACHER_IMPORT_FIELDS.map((field) => field.key);

export const TEACHER_IMPORT_HEADER_LABELS: Record<string, string> =
  Object.fromEntries(
    TEACHER_IMPORT_FIELDS.map((field) => [field.key, field.label]),
  );

export const TEACHER_IMPORT_WORKSHEET_NAME = 'Teachers';

export const TEACHER_IMPORT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const TEACHER_IMPORT_MAX_ROWS = 5000;

export const TEACHER_IMPORT_MAX_FULL_NAME_LENGTH = 150;

export const TEACHER_IMPORT_MAX_TEACHER_CODE_LENGTH = 50;

export const TEACHER_IMPORT_MAX_SPECIALIZATION_LENGTH = 100;

export const TEACHER_IMPORT_MAX_QUALIFICATION_LENGTH = 100;

export const TEACHER_IMPORT_MAX_BIO_LENGTH = 2000;

export const TEACHER_IMPORT_EMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

export const TEACHER_IMPORT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
