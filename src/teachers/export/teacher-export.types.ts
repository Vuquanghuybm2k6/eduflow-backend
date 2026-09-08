import { TeacherStatus } from '../entities/teacher.entity';

export const TEACHER_EXPORT_SHEET_NAME = 'Giáo viên';

export const TEACHER_EXPORT_HEADERS = [
  'Mã giáo viên',
  'Họ và tên',
  'Email',
  'Chuyên môn',
  'Trình độ',
  'Giới thiệu',
  'Ngày vào làm',
  'Chi nhánh',
  'Trạng thái',
  'Ngày tạo',
] as const;

export const TEACHER_EXPORT_COLUMN_WIDTHS = [
  15, 25, 30, 25, 25, 40, 15, 30, 15, 22,
];

export const TEACHER_EXPORT_QUALIFICATION_COLUMN_INDEX = 5;
export const TEACHER_EXPORT_BIO_COLUMN_INDEX = 6;
export const TEACHER_EXPORT_BRANCHES_COLUMN_INDEX = 8;

export const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export interface TeacherExportResult {
  buffer: Buffer;
  filename: string;
}
