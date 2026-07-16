// Normalizes to a bare international digit string (no "+"), the format
// tel:/wa.me links expect. Biased toward KZ/RU numbers like the rest of the
// phone handling in this codebase (see utils/phone.ts).
export function phoneDigitsForLink(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits[0] === '8') digits = `7${digits.slice(1)}`;
  return digits;
}

export function telHref(raw: string | null | undefined): string {
  const digits = phoneDigitsForLink(raw);
  return digits ? `tel:+${digits}` : '';
}

export function whatsappHref(raw: string | null | undefined): string {
  const digits = phoneDigitsForLink(raw);
  return digits ? `https://wa.me/${digits}` : '';
}
