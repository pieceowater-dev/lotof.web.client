import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';

export function formatDisplayPhoneUniversal(value: string): string {
  const input = String(value || '').trim();
  if (!input) return '';

  const parsed = parsePhoneNumberFromString(input);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }

  // Fallback for numbers stored as digits without '+' prefix.
  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    const withPlus = `+${digitsOnly}`;
    const parsedWithPlus = parsePhoneNumberFromString(withPlus);
    if (parsedWithPlus && parsedWithPlus.isValid()) {
      return parsedWithPlus.formatInternational();
    }

    const formattedWithPlus = new AsYouType().input(withPlus);
    if (formattedWithPlus) {
      return formattedWithPlus;
    }
  }

  const asYouType = new AsYouType();
  const formatted = asYouType.input(input);
  return formatted || input;
}
