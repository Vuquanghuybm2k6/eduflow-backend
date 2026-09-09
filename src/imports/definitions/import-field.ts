import { normalizeHeader } from '../../common/excel/excel.utils';

export interface ImportFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description?: string;
  example?: string;
  aliases?: readonly string[];
}

export interface ImportDefinition {
  fields: readonly ImportFieldDefinition[];
}

export function buildImportHeaderLookup(
  definition: ImportDefinition,
): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();

  for (const field of definition.fields) {
    lookup.set(normalizeHeader(field.key), field.key);
    lookup.set(normalizeHeader(field.label), field.key);

    for (const alias of field.aliases ?? []) {
      lookup.set(normalizeHeader(alias), field.key);
    }
  }

  return lookup;
}

export function resolveImportHeader(
  rawHeader: unknown,
  definition: ImportDefinition,
  lookup: ReadonlyMap<string, string> = buildImportHeaderLookup(definition),
): string {
  const normalized = normalizeHeader(rawHeader);

  if (normalized === '') {
    return '';
  }

  return lookup.get(normalized) ?? normalized;
}

export function resolveImportHeaders(
  rawHeaders: readonly unknown[],
  definition: ImportDefinition,
): string[] {
  const lookup = buildImportHeaderLookup(definition);

  return rawHeaders.map((header) =>
    resolveImportHeader(header, definition, lookup),
  );
}
