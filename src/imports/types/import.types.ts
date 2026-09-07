export type StudentImportField =
  | 'student_code'
  | 'full_name'
  | 'email'
  | 'phone'
  | 'date_of_birth'
  | 'gender'
  | 'branch_code';

export interface ImportParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export interface ImportRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportRowResult {
  rowNumber: number;
  values: Record<string, unknown>;
  valid: boolean;
  errors: ImportRowError[];
}

export interface ImportPreview {
  importJobId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowResult[];
}

export enum ImportJobRowOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface ImportJobRowResult {
  rowNumber: number;
  status: ImportJobRowOutcome;
  errors: Array<{ field: string; message: string }>;
}

export interface ImportJobResult {
  importJobId: string;
  total: number;
  success: number;
  failed: number;
  rows: ImportJobRowResult[];
}
