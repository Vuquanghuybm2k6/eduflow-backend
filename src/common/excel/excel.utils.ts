export function normalizeHeader(value: unknown): string {
  // chuẩn hóa ô header thành string
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

export function normalizeCellValue(value: unknown): unknown {
  // chuẩn hóa giá trị của một ô dữ liệu
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object') {
    const text = unwrapCellText(value);

    if (text !== null) {
      return text;
    }
  }

  return value;
}

function unwrapCellText(value: object): string | null {
  // lấy text từ ô rich-text / hyperlink của ExcelJS
  const record = value as Record<string, unknown>;

  if (typeof record['text'] === 'string') {
    return record['text'].trim();
  }

  if (Array.isArray(record['richText'])) {
    const parts: string[] = [];

    for (const part of record['richText']) {
      const text = (part as Record<string, unknown>)['text'];

      if (typeof text === 'string') {
        parts.push(text);
      }
    }

    if (parts.length > 0) {
      return parts.join('').trim();
    }
  }

  return null;
}

export function isEmptyRow(values: unknown[]): boolean {
  // kiểm tra một dòng có trống hoàn toàn không
  return values.every(
    (value) => value === null || value === undefined || value === '',
  );
}

const EXCEL_FORMULA_PREFIXES = ['=', '+', '-', '@'];

export function sanitizeExcelString(value: unknown): unknown {
  // ngăn chặn Excel formula injection: các chuỗi bắt đầu bằng = + - @ sẽ bị
  // thêm dấu nháy đơn phía trước để Excel coi là text (không phải công thức)
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  const firstChar = value.trimStart().charAt(0);

  if (firstChar && EXCEL_FORMULA_PREFIXES.includes(firstChar)) {
    return `'${value}`;
  }

  return value;
}
