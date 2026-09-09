import { Gender } from '../../users/entities/user.entity';
import { StudentStatus } from '../entities/student.entity';

export const STUDENT_EXPORT_SHEET_NAME = 'Học viên';

export const STUDENT_EXPORT_HEADERS = [
  'Mã học viên',
  'Họ và tên',
  'Email',
  'Ngày sinh',
  'Giới tính',
  'Chi nhánh',
  'Trạng thái',
  'Địa chỉ',
  'Ngày tạo',
] as const;

export const STUDENT_EXPORT_COLUMN_WIDTHS = [
  18, 26, 30, 16, 12, 24, 22, 40, 20,
];

export const STUDENT_EXPORT_ADDRESS_COLUMN_INDEX = 8;

export const STUDENT_GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export interface StudentExportResult {
  buffer: Buffer;
  filename: string;
}
