import { normalizeHeader } from '../../common/excel/excel.utils';
import { STUDENT_IMPORT_DEFINITION } from '../../students/import/student-import.types';
import { TEACHER_IMPORT_DEFINITION } from '../../teachers/import/teacher-import.constants';
import {
  buildImportHeaderLookup,
  resolveImportHeader,
  resolveImportHeaders,
} from './import-field';

describe('import field definitions', () => {
  describe('normalizeHeader variants', () => {
    it('normalizes every student header variant', () => {
      expect(normalizeHeader('Mã học viên')).toBe('mã học viên');
      expect(normalizeHeader('MÃ HỌC VIÊN')).toBe('mã học viên');
      expect(normalizeHeader('Mã Học Viên')).toBe('mã học viên');
      expect(normalizeHeader(' mã học viên ')).toBe('mã học viên');
      expect(normalizeHeader('mã_học_viên')).toBe('mã học viên');
      expect(normalizeHeader('mã-học-viên')).toBe('mã học viên');
    });

    it('normalizes every teacher header variant', () => {
      expect(normalizeHeader('Giới tính')).toBe('giới tính');
      expect(normalizeHeader('GIỚI TÍNH')).toBe('giới tính');
      expect(normalizeHeader('Giới Tính')).toBe('giới tính');
      expect(normalizeHeader(' giới tính ')).toBe('giới tính');
      expect(normalizeHeader('giới_tính')).toBe('giới tính');
    });
  });

  describe('buildImportHeaderLookup', () => {
    it('maps normalized labels and internal keys to the internal key', () => {
      const lookup = buildImportHeaderLookup(STUDENT_IMPORT_DEFINITION);

      expect(lookup.get('mã học viên')).toBe('student_code');
      expect(lookup.get('student code')).toBe('student_code');
      expect(lookup.get('giới tính')).toBe('gender');
    });

    it('maps normalized English aliases to the internal key', () => {
      const studentLookup = buildImportHeaderLookup(STUDENT_IMPORT_DEFINITION);
      expect(studentLookup.get('date of birth')).toBe('date_of_birth');
      expect(studentLookup.get('dob')).toBe('date_of_birth');
      expect(studentLookup.get('branch code')).toBe('branch_code');

      const teacherLookup = buildImportHeaderLookup(TEACHER_IMPORT_DEFINITION);
      expect(teacherLookup.get('teacher code')).toBe('teacher_code');
      expect(teacherLookup.get('hire date')).toBe('hire_date');
      expect(teacherLookup.get('branch codes')).toBe('branch_codes');
    });
  });

  describe('resolveImportHeader', () => {
    it('maps every student "Mã học viên" variant to student_code', () => {
      for (const variant of [
        'Mã học viên',
        'MÃ HỌC VIÊN',
        'Mã Học Viên',
        ' mã học viên ',
        'mã_học_viên',
        'mã-học-viên',
      ]) {
        expect(resolveImportHeader(variant, STUDENT_IMPORT_DEFINITION)).toBe(
          'student_code',
        );
      }
    });

    it('maps every teacher "Giới tính" variant to gender', () => {
      for (const variant of [
        'Giới tính',
        'GIỚI TÍNH',
        'Giới Tính',
        ' giới tính ',
        'giới_tính',
      ]) {
        expect(resolveImportHeader(variant, TEACHER_IMPORT_DEFINITION)).toBe(
          'gender',
        );
      }
    });

    it('maps canonical English keys back to the internal key', () => {
      expect(
        resolveImportHeader('student_code', STUDENT_IMPORT_DEFINITION),
      ).toBe('student_code');
      expect(
        resolveImportHeader('student-code', STUDENT_IMPORT_DEFINITION),
      ).toBe('student_code');
    });

    it('maps English aliases such as DOB to the internal key', () => {
      expect(resolveImportHeader('DOB', STUDENT_IMPORT_DEFINITION)).toBe(
        'date_of_birth',
      );
      expect(
        resolveImportHeader('Date of Birth', STUDENT_IMPORT_DEFINITION),
      ).toBe('date_of_birth');
      expect(
        resolveImportHeader('Teacher Code', TEACHER_IMPORT_DEFINITION),
      ).toBe('teacher_code');
    });

    it('keeps unknown headers normalized so the validator can flag them', () => {
      expect(
        resolveImportHeader('Địa chỉ nhà', STUDENT_IMPORT_DEFINITION),
      ).toBe('địa chỉ nhà');
    });

    it('maps empty headers to an empty string', () => {
      expect(resolveImportHeader('', STUDENT_IMPORT_DEFINITION)).toBe('');
      expect(resolveImportHeader('   ', STUDENT_IMPORT_DEFINITION)).toBe('');
      expect(resolveImportHeader(null, STUDENT_IMPORT_DEFINITION)).toBe('');
    });

    it('unwraps rich-text and hyperlink cells before matching', () => {
      expect(
        resolveImportHeader(
          { richText: [{ text: 'Mã ' }, { text: 'học viên' }] },
          STUDENT_IMPORT_DEFINITION,
        ),
      ).toBe('student_code');
      expect(
        resolveImportHeader(
          { text: ' Giới tính ', hyperlink: '#' },
          STUDENT_IMPORT_DEFINITION,
        ),
      ).toBe('gender');
    });
  });

  describe('resolveImportHeaders', () => {
    it('maps an ordered row of mixed student header variants', () => {
      const headers = [
        'Mã Học Viên',
        'Họ_và_tên',
        'EMAIL',
        'số điện thoại',
        'Ngày Sinh',
        'giới-tính',
        'MÃ CHI NHÁNH',
      ];

      expect(resolveImportHeaders(headers, STUDENT_IMPORT_DEFINITION)).toEqual([
        'student_code',
        'full_name',
        'email',
        'phone',
        'date_of_birth',
        'gender',
        'branch_code',
      ]);
    });

    it('maps an ordered row of mixed teacher header variants', () => {
      const headers = [
        'Email',
        'Họ và tên',
        'Mã Giáo Viên',
        'Chuyên môn',
        'Bằng cấp',
        'Giới thiệu',
        'Ngày tuyển dụng',
        'Giới Tính',
        'Mã chi nhánh',
      ];

      expect(resolveImportHeaders(headers, TEACHER_IMPORT_DEFINITION)).toEqual([
        'email',
        'full_name',
        'teacher_code',
        'specialization',
        'qualification',
        'bio',
        'hire_date',
        'gender',
        'branch_codes',
      ]);
    });
  });
});
