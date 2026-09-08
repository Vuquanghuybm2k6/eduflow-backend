import {
  isEmptyRow,
  normalizeCellValue,
  normalizeHeader,
  sanitizeExcelString,
} from './excel.utils';

describe('excel.utils', () => {
  describe('normalizeHeader', () => {
    it('should convert a value to a trimmed string', () => {
      expect(normalizeHeader(' student_code ')).toBe('student_code');
    });

    it('should convert non-string values to strings', () => {
      expect(normalizeHeader(123)).toBe('123');
    });

    it('should convert nullish values to an empty string', () => {
      expect(normalizeHeader(null)).toBe('');
      expect(normalizeHeader(undefined)).toBe('');
    });
  });

  describe('normalizeCellValue', () => {
    it('should trim string values', () => {
      expect(normalizeCellValue('  Nguyen A  ')).toBe('Nguyen A');
    });

    it('should keep non-string values unchanged', () => {
      const date = new Date('2026-09-06T00:00:00.000Z');

      expect(normalizeCellValue(123)).toBe(123);
      expect(normalizeCellValue(date)).toBe(date);
      expect(normalizeCellValue(null)).toBeNull();
      expect(normalizeCellValue(undefined)).toBeUndefined();
    });

    it('should unwrap hyperlink cells to their text', () => {
      expect(
        normalizeCellValue({
          text: '  a@gmail.com  ',
          hyperlink: 'mailto:a@gmail.com',
        }),
      ).toBe('a@gmail.com');
    });

    it('should unwrap rich text cells to their concatenated text', () => {
      expect(
        normalizeCellValue({
          richText: [{ text: 'Nguyen ' }, { text: 'Van A' }],
        }),
      ).toBe('Nguyen Van A');
    });
  });

  describe('isEmptyRow', () => {
    it('should return true when every value is empty', () => {
      expect(isEmptyRow([])).toBe(true);
      expect(isEmptyRow([null, undefined, ''])).toBe(true);
    });

    it('should return false when any value is present', () => {
      expect(isEmptyRow(['ST001'])).toBe(false);
      expect(isEmptyRow([null, 'name', ''])).toBe(false);
    });
  });

  describe('sanitizeExcelString', () => {
    it('should prefix strings starting with formula characters', () => {
      expect(sanitizeExcelString('=1+1')).toBe("'=1+1");
      expect(sanitizeExcelString('+84900000')).toBe("'+84900000");
      expect(sanitizeExcelString('-2+3')).toBe("'-2+3");
      expect(sanitizeExcelString('@import "x"')).toBe("'@import \"x\"");
    });

    it('should prefix values that only start with a formula character after whitespace', () => {
      expect(sanitizeExcelString('  =SUM(A1)')).toBe("'  =SUM(A1)");
    });

    it('should keep normal strings unchanged', () => {
      expect(sanitizeExcelString('Nguyen Van A')).toBe('Nguyen Van A');
      expect(sanitizeExcelString('a+b')).toBe('a+b');
      expect(sanitizeExcelString('8:30')).toBe('8:30');
    });

    it('should keep non-string values unchanged', () => {
      expect(sanitizeExcelString(42)).toBe(42);
      expect(sanitizeExcelString(null)).toBeNull();
      expect(sanitizeExcelString(undefined)).toBeUndefined();
      expect(sanitizeExcelString('')).toBe('');
    });
  });
});
