export interface ExcelRow {
  rowNumber: number;
  values: unknown[];
}

export interface ExcelWorksheetData {
  name: string;
  headers: string[];
  rows: ExcelRow[];
}
