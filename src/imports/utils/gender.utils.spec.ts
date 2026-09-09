import { normalizeGenderValue } from './gender.utils';

describe('normalizeGenderValue', () => {
  it('normalizes English gender values in any casing', () => {
    expect(normalizeGenderValue('male')).toBe('MALE');
    expect(normalizeGenderValue('MALE')).toBe('MALE');
    expect(normalizeGenderValue('Female')).toBe('FEMALE');
    expect(normalizeGenderValue(' other ')).toBe('OTHER');
  });

  it('normalizes Vietnamese gender values to the gender enum', () => {
    expect(normalizeGenderValue('Nam')).toBe('MALE');
    expect(normalizeGenderValue('NAM')).toBe('MALE');
    expect(normalizeGenderValue('nữ')).toBe('FEMALE');
    expect(normalizeGenderValue('NỮ')).toBe('FEMALE');
    expect(normalizeGenderValue('Khác')).toBe('OTHER');
    expect(normalizeGenderValue('khac')).toBe('OTHER');
    expect(normalizeGenderValue('nu')).toBe('FEMALE');
  });

  it('returns null for empty or whitespace values', () => {
    expect(normalizeGenderValue('')).toBeNull();
    expect(normalizeGenderValue('   ')).toBeNull();
    expect(normalizeGenderValue(null)).toBeNull();
    expect(normalizeGenderValue(undefined)).toBeNull();
  });

  it('returns null for unknown or non-string values', () => {
    expect(normalizeGenderValue('UNKNOWN')).toBeNull();
    expect(normalizeGenderValue(123)).toBeNull();
    expect(normalizeGenderValue({ text: 'nam' })).toBeNull();
  });
});
