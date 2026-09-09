import type {
  ImportDefinition,
  ImportFieldDefinition,
} from '../../imports/definitions/import-field';

export const STUDENT_IMPORT_FIELDS: readonly ImportFieldDefinition[] = [
  {
    key: 'student_code',
    label: 'Mã học viên',
    aliases: ['Student Code', 'Student code', 'student code'],
    required: true,
    description: 'Mã học viên duy nhất trong tổ chức',
    example: 'HS001',
  },
  {
    key: 'full_name',
    label: 'Họ và tên',
    aliases: ['Full Name', 'full name', 'Full name'],
    required: true,
    description: 'Họ và tên đầy đủ của học viên',
    example: 'Nguyen Van A',
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['E-mail', 'e-mail'],
    required: true,
    description: 'Email của học viên, phải kết thúc bằng @gmail.com',
    example: 'nguyenvana.template@gmail.com',
  },
  {
    key: 'phone',
    label: 'Số điện thoại',
    aliases: ['Phone', 'Mobile', 'Phone Number', 'Phone number'],
    required: false,
    description: 'Số điện thoại của học viên (không bắt buộc)',
    example: '0901234567',
  },
  {
    key: 'date_of_birth',
    label: 'Ngày sinh',
    aliases: ['Date of Birth', 'Date of birth', 'DOB'],
    required: false,
    description: 'Ngày sinh, định dạng YYYY-MM-DD',
    example: '2015-09-01',
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
    key: 'branch_code',
    label: 'Mã chi nhánh',
    aliases: ['Branch Code', 'Branch code'],
    required: true,
    description: 'Mã chi nhánh của học viên',
    example: 'BR001',
  },
];

export const STUDENT_IMPORT_DEFINITION: ImportDefinition = {
  fields: STUDENT_IMPORT_FIELDS,
};

export const STUDENT_IMPORT_HEADERS: readonly string[] =
  STUDENT_IMPORT_FIELDS.map((field) => field.key);

export const STUDENT_IMPORT_HEADER_LABELS: Record<string, string> =
  Object.fromEntries(
    STUDENT_IMPORT_FIELDS.map((field) => [field.key, field.label]),
  );

export type StudentImportField =
  | 'student_code'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'date_of_birth'
  | 'gender'
  | 'branch_code';

export interface StudentImportMeta {
  headers: string[];
  headerLabels: Record<string, string>;
  maxFileSizeBytes: number;
  allowedExtensions: string[];
}
