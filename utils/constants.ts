/**
 * Application-wide constants and enums
 */

/**
 * Pagination length options used across list queries
 */
export enum PaginationLength {
  TEN = 'TEN',
  FIFTEEN = 'FIFTEEN',
  TWENTY = 'TWENTY',
  TWENTY_FIVE = 'TWENTY_FIVE',
  THIRTY = 'THIRTY',
  THIRTY_FIVE = 'THIRTY_FIVE',
  FORTY = 'FORTY',
  FORTY_FIVE = 'FORTY_FIVE',
  FIFTY = 'FIFTY',
  FIFTY_FIVE = 'FIFTY_FIVE',
  SIXTY = 'SIXTY',
  SIXTY_FIVE = 'SIXTY_FIVE',
  SEVENTY = 'SEVENTY',
  SEVENTY_FIVE = 'SEVENTY_FIVE',
  EIGHTY = 'EIGHTY',
  EIGHTY_FIVE = 'EIGHTY_FIVE',
  NINETY = 'NINETY',
  NINETY_FIVE = 'NINETY_FIVE',
  ONE_HUNDRED = 'ONE_HUNDRED',
}

/**
 * QR code generation methods
 */
export enum QRMethod {
  POST_PHRASE = 'METHOD_POST_PHRASE',
  QR = 'METHOD_QR',
  QR_STATIC = 'METHOD_QR_STATIC',
}

/**
 * Map of QR method codes to method enums
 */
export const QR_METHOD_MAP: Record<string, QRMethod> = {
  '1': QRMethod.POST_PHRASE,
  '2': QRMethod.QR,
};

/**
 * Export-related constants
 */
export const EXPORT = {
  MAX_DATE_RANGE_DAYS: 100,
  DEFAULT_LANGUAGE: 'en',
} as const;

/**
 * Component and UI defaults
 */
export const UI_DEFAULTS = {
  EXPORT_BUTTON_LABEL: 'Export',
  DATE_FORMAT: 'DD.MM.YYYY',
} as const;
