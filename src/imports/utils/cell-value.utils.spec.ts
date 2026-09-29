import { readCellString, readOptionalCellString } from './cell-value.utils';

describe('readCellString', () => {
  it('trims string values', () => {
    expect(readCellString('  BR001 ')).toBe('BR001');
    expect(readCellString('a@b.com')).toBe('a@b.com');
  });

  it('coerces numbers and booleans to text', () => {
    expect(readCellString(0)).toBe('0');
    expect(readCellString(42)).toBe('42');
    expect(readCellString(true)).toBe('true');
  });

  it('returns an empty string for empty, missing and non-primitive values', () => {
    expect(readCellString('')).toBe('');
    expect(readCellString('   ')).toBe('');
    expect(readCellString(null)).toBe('');
    expect(readCellString(undefined)).toBe('');
    expect(readCellString({ code: 'BR001' })).toBe('');
    expect(readCellString(['BR001'])).toBe('');
  });
});

describe('readOptionalCellString', () => {
  it('returns null for empty and missing values', () => {
    expect(readOptionalCellString('')).toBeNull();
    expect(readOptionalCellString('   ')).toBeNull();
    expect(readOptionalCellString(null)).toBeNull();
    expect(readOptionalCellString(undefined)).toBeNull();
  });

  it('returns trimmed text for populated values', () => {
    expect(readOptionalCellString(' 0901234567 ')).toBe('0901234567');
    expect(readOptionalCellString(901234567)).toBe('901234567');
  });

  it('returns null instead of stringifying non-primitive values', () => {
    expect(readOptionalCellString({ phone: '0901234567' })).toBeNull();
    expect(readOptionalCellString(['0901234567'])).toBeNull();
  });
});
