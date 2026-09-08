export interface ExcelRow {
  rowNumber: number;
  values: unknown[];
}

export interface ExcelWorksheetData {
  name: string;
  headers: string[];
  rows: ExcelRow[];
}

export interface ExcelExportWorksheet {
  name: string;
  headers: string[];
  rows: unknown[][];
  columnWidths?: number[];
  wrapColumns?: number[];
}
