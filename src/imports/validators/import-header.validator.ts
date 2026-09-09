import { BadRequestException, Injectable } from '@nestjs/common';

import type { ImportDefinition } from '../definitions/import-field';
import {
  buildImportHeaderLookup,
  resolveImportHeader,
} from '../definitions/import-field';

export interface ImportHeaderValidatorOptions {
  ignoreUnexpected?: boolean;
}

@Injectable()
export class ImportHeaderValidator {
  validate(
    rawHeaders: readonly unknown[],
    definition: ImportDefinition,
    options: ImportHeaderValidatorOptions = {},
  ): string[] {
    const lookup = buildImportHeaderLookup(definition);
    const fieldKeys = new Set(definition.fields.map((field) => field.key));

    const resolved = rawHeaders.map((header) =>
      resolveImportHeader(header, definition, lookup),
    );
    const present = resolved.filter((header) => header !== '');

    const missing = definition.fields.filter(
      (field) => !present.includes(field.key),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Thiếu cột bắt buộc: ${missing.map((field) => field.label).join(', ')}`,
      );
    }

    if (!options.ignoreUnexpected) {
      const unexpected = resolved
        .map((header, index) =>
          header !== '' && !fieldKeys.has(header) ? index : -1,
        )
        .filter((index) => index >= 0)
        .map((index) => String(rawHeaders[index]).trim());

      if (unexpected.length > 0) {
        throw new BadRequestException(
          `Cột không hợp lệ: ${unexpected.join(', ')}`,
        );
      }
    }

    const seen = new Set<string>();
    const duplicateKeys: string[] = [];

    for (const header of present) {
      if (!fieldKeys.has(header)) {
        continue;
      }

      if (seen.has(header)) {
        duplicateKeys.push(header);
      }
      seen.add(header);
    }

    if (duplicateKeys.length > 0) {
      const labelFor = new Map(
        definition.fields.map((field) => [field.key, field.label]),
      );
      const fileName = duplicateKeys
        .map((key) => labelFor.get(key) ?? key)
        .join(', ');
      throw new BadRequestException(`Cột bị lặp: ${fileName}`);
    }

    return resolved;
  }
}
