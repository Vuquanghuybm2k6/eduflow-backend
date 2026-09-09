export const IMPORT_TEMPLATE_LANGUAGES = ['vi', 'en'] as const;

export type ImportTemplateLanguage = (typeof IMPORT_TEMPLATE_LANGUAGES)[number];

export const DEFAULT_IMPORT_TEMPLATE_LANGUAGE: ImportTemplateLanguage = 'vi';
