export function normalizeHeader(value: unknown): string { // chuẩn hóa ô header thành string
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

export function normalizeCellValue(value: unknown): unknown { // chuẩn hóa giá trị của một ô dữ liệu
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

export function isEmptyRow(values: unknown[]): boolean { // kiểm tra một dòng có trống hoàn toàn không
  return values.every(
    (value) => value === null || value === undefined || value === '',
  );
}
