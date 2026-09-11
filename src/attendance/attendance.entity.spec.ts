import { getMetadataArgsStorage } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';

describe('Attendance entity', () => {
  it('maps to the attendances table', () => {
    const tables = getMetadataArgsStorage().tables.filter(
      (t) => t.target === Attendance,
    );
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('attendances');
  });

  it('enforces a unique constraint on (sessionId, studentId)', () => {
    const uniques = getMetadataArgsStorage().uniques.filter(
      (u) => u.target === Attendance,
    );
    expect(uniques).toHaveLength(1);
    expect(uniques[0].columns).toEqual(['sessionId', 'studentId']);
  });

  it('exposes PRESENT, ABSENT, LATE and EXCUSED statuses', () => {
    expect(AttendanceStatus).toEqual({
      PRESENT: 'PRESENT',
      ABSENT: 'ABSENT',
      LATE: 'LATE',
      EXCUSED: 'EXCUSED',
    });
  });
});
