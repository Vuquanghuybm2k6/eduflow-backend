export const STUDENT_IMPORT_HEADERS: readonly string[] = [
  'student_code',
  'full_name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'branch_code',
];

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