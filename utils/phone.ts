import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

// Primary market: lets libphonenumber recognize domestic-format numbers that
// have no country code at all, including the common "8 700 ..." trunk-prefix
// style Kazakhstani/Russian users type instead of "+7 700 ...".
const DEFAULT_COUNTRY: CountryCode = 'KZ';

// Shared input-time mask: strips everything except digits/+/()/space/dash
// as the user types. Same rule used across Contacts and Menu phone fields.
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}

export function isPhoneInputValid(value: string): boolean {
  if (!value) return true;

  const input = String(value).trim();
  const parsed = parsePhoneNumberFromString(input, DEFAULT_COUNTRY);
  if (parsed && parsed.isValid()) return true;

  // Numbers stored/typed as digits without a leading '+' -- retry with one,
  // same fallback strategy formatDisplayPhoneUniversal uses.
  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return false;
  const parsedWithPlus = parsePhoneNumberFromString(`+${digitsOnly}`);
  return Boolean(parsedWithPlus && parsedWithPlus.isValid());
}

function maskWithCountryCode(digitsOnly: string): string | null {
  // Expected canonical shape: country code (1-3) + national part (10 digits).
  if (digitsOnly.length < 11 || digitsOnly.length > 13) return null;

  const ccLength = digitsOnly.length - 10;
  if (ccLength < 1 || ccLength > 3) return null;

  const cc = digitsOnly.slice(0, ccLength);
  const national = digitsOnly.slice(ccLength);

  return `+${cc} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8, 10)}`;
}

// Canonical storage format: E.164 (e.g. "+77001234567"), no spaces/dashes/
// parens -- so the same logical number always lands as the same DB string
// no matter how the user typed it ("8 (700) 123-45-67" vs "+7 700 123 45 67"
// vs "77001234567" all collapse to one value). Every phone-writing call site
// should pass its input through this immediately before sending to the
// backend; utils/phone.ts's other helpers stay display/input-mask concerns.
export function normalizePhoneForStorage(value: string): string {
  const input = String(value || '').trim();
  if (!input) return '';

  const parsed = parsePhoneNumberFromString(input, DEFAULT_COUNTRY);
  if (parsed && parsed.isValid()) return parsed.format('E.164');

  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    const parsedWithPlus = parsePhoneNumberFromString(`+${digitsOnly}`);
    if (parsedWithPlus && parsedWithPlus.isValid()) return parsedWithPlus.format('E.164');
  }

  // Not a recognizable number (e.g. a short internal extension) -- fall back
  // to the sanitized-but-unnormalized input rather than rejecting it, since
  // validity is already enforced separately by isPhoneInputValid.
  return input;
}

export function formatDisplayPhoneUniversal(value: string): string {
  const input = String(value || '').trim();
  if (!input) return '';

  const digitsOnly = input.replace(/\D/g, '');
  const strictMask = maskWithCountryCode(digitsOnly);
  if (strictMask) {
    return strictMask;
  }

  const parsed = parsePhoneNumberFromString(input, DEFAULT_COUNTRY);
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
