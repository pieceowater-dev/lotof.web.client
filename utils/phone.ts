import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';

export function formatDisplayPhoneUniversal(value: string): string {
  const input = String(value || '').trim();
  if (!input) return '';

  const parsed = parsePhoneNumberFromString(input);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }

  const asYouType = new AsYouType();
  const formatted = asYouType.input(input);
  return formatted || input;
}
