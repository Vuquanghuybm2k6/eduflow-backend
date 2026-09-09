import { IsIn, IsOptional } from 'class-validator';
import { IMPORT_TEMPLATE_LANGUAGES } from '../import-template.constants';

export class DownloadImportTemplateQueryDto {
  @IsOptional()
  @IsIn(IMPORT_TEMPLATE_LANGUAGES)
  lang?: (typeof IMPORT_TEMPLATE_LANGUAGES)[number];
}
