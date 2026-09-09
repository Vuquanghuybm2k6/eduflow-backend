import { Gender } from '../../users/entities/user.entity';

const GENDER_ALIASES: Record<string, Gender> = {
  MALE: Gender.MALE,
  NAM: Gender.MALE,
  FEMALE: Gender.FEMALE,
  NỮ: Gender.FEMALE,
  NU: Gender.FEMALE,
  OTHER: Gender.OTHER,
  KHÁC: Gender.OTHER,
  KHAC: Gender.OTHER,
};

export function normalizeGenderValue(raw: unknown): Gender | null {
  const text =
    typeof raw === 'string'
      ? raw.trim().toUpperCase()
      : typeof raw === 'number' || typeof raw === 'boolean'
        ? String(raw).trim().toUpperCase()
        : null;

  if (text === null || text === '') {
    return null;
  }

  return GENDER_ALIASES[text] ?? null;
}
