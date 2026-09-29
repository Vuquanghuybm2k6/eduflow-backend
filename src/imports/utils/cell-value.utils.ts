export function readCellString(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).trim();
  }

  return '';
}

export function readOptionalCellString(raw: unknown): string | null {
  if (typeof raw === 'string') {
    return raw.trim() || null;
  }

  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).trim();
  }

  return null;
}
