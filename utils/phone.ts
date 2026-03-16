import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';

function maskWithCountryCode(digitsOnly: string): string | null {
  // Expected canonical shape: country code (1-3) + national part (10 digits).
  if (digitsOnly.length < 11 || digitsOnly.length > 13) return null;

  const ccLength = digitsOnly.length - 10;
  if (ccLength < 1 || ccLength > 3) return null;

  const cc = digitsOnly.slice(0, ccLength);
  const national = digitsOnly.slice(ccLength);

  return `+${cc} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8, 10)}`;
}

export function formatDisplayPhoneUniversal(value: string): string {
  const input = String(value || '').trim();
  if (!input) return '';

  const digitsOnly = input.replace(/\D/g, '');
  const strictMask = maskWithCountryCode(digitsOnly);
  if (strictMask) {
    return strictMask;
  }

  const parsed = parsePhoneNumberFromString(input);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }

  // Fallback for numbers stored as digits without '+' prefix.
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
