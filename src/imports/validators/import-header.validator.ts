import { BadRequestException, Injectable } from '@nestjs/common';

import { normalizeHeader } from '../../common/excel/excel.utils';

export interface ImportHeaderValidatorOptions {
  ignoreUnexpected?: boolean;
}

@Injectable()
export class ImportHeaderValidator {
  validate(
    headers: string[],
    expectedHeaders: readonly string[],
    options: ImportHeaderValidatorOptions = {},
  ): void {
    const normalized = headers.map((header) =>
      normalizeHeader(header).toLowerCase(),
    );
    const present = normalized.filter((header) => header !== '');

    const missing = expectedHeaders.filter(
      (required) => !present.includes(required),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Thiếu cột bắt buộc: ${missing.join(', ')}`,
      );
    }

    if (!options.ignoreUnexpected) {
      const unexpected = present.filter(
        (header) => !expectedHeaders.includes(header),
      );

      if (unexpected.length > 0) {
        throw new BadRequestException(
          `Cột không hợp lệ: ${unexpected.join(', ')}`,
        );
      }
    }

    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const header of present) {
      if (seen.has(header)) {
        duplicates.push(header);
      }
      seen.add(header);
    }

    if (duplicates.length > 0) {
      throw new BadRequestException(`Cột bị lặp: ${duplicates.join(', ')}`);
    }
  }
}
