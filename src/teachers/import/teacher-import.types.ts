import { Gender } from '../../users/entities/user.entity';

export type TeacherImportField =
  | 'email'
  | 'full_name'
  | 'teacher_code'
  | 'specialization'
  | 'qualification'
  | 'bio'
  | 'hire_date'
  | 'gender'
  | 'branch_codes';

export interface TeacherImportRowData {
  email: string;
  full_name: string;
  teacher_code: string;
  specialization: string | null;
  qualification: string | null;
  bio: string | null;
  hire_date: string | null;
  gender: Gender | null;
  branch_codes: string[];
}

export type TeacherImportRowStatus = 'VALID' | 'INVALID';

export interface TeacherImportRowError {
  field: string;
  message: string;
}

export interface TeacherImportRowResult {
  rowNumber: number;
  status: TeacherImportRowStatus;
  data: TeacherImportRowData;
  errors: TeacherImportRowError[];
}

export interface TeacherImportPreview {
  importJobId: string;
  total: number;
  valid: number;
  invalid: number;
  rows: TeacherImportRowResult[];
}

export interface TeacherImportMeta {
  headers: string[];
  headerLabels: Record<string, string>;
  maxFileSizeBytes: number;
  allowedExtensions: string[];
}
