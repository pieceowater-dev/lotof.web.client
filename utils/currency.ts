export const CURRENCIES = [
  { code: 'KZT', label: 'KZT — Kazakhstani Tenge', symbol: '₸' },
  { code: 'RUB', label: 'RUB — Russian Ruble', symbol: '₽' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'KGS', label: 'KGS — Kyrgyzstani Som', symbol: 'с' },
  { code: 'UZS', label: 'UZS — Uzbekistani Som', symbol: 'сум' },
  { code: 'TJS', label: 'TJS — Tajikistani Somoni', symbol: 'ЅМ' },
  { code: 'BYN', label: 'BYN — Belarusian Ruble', symbol: 'Br' },
  { code: 'AZN', label: 'AZN — Azerbaijani Manat', symbol: '₼' },
  { code: 'GEL', label: 'GEL — Georgian Lari', symbol: '₾' },
  { code: 'AMD', label: 'AMD — Armenian Dram', symbol: '֏' },
  { code: 'AED', label: 'AED — UAE Dirham', symbol: 'AED' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'TRY', label: 'TRY — Turkish Lira', symbol: '₺' },
  { code: 'CNY', label: 'CNY — Chinese Yuan', symbol: '¥' },
] as const;

export const DEFAULT_CURRENCY_CODE = 'KZT';

export function currencyByCode(code?: string | null) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY_CODE)!;
}

export function currencySymbol(code?: string | null): string {
  return currencyByCode(code).symbol;
}

// Formats a monetary amount for display: grouped thousands, no decimals for
// whole numbers, up to 2 decimals otherwise, followed by the currency symbol
// (matches how prices are conventionally written in this region — amount
// first, symbol after — rather than Intl's locale-guessed placement).
export function formatMoney(amount: number | null | undefined, code?: string | null): string {
  const value = amount ?? 0;
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${currencySymbol(code)}`;
}
