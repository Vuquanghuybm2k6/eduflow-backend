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
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowResult[];
}
