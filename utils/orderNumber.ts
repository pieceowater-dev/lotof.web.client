// The backend allocates order.number as a simple per-day sequential counter
// with no prefix of its own (see lotof.menu.msvc.core's allocateOrderNumber).
// Prefixing the display with the creation date turns a bare "#7" — which
// repeats every day — into a number that's actually unique and orderable
// across days, without needing a backend numbering-scheme change.
export function smartOrderNumber(order: { number: number; createdAt: string }): string {
  const d = new Date(order.createdAt);
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}-${String(order.number).padStart(3, '0')}`;
}

// Reverses smartOrderNumber(): "YYMMDD-NNN" -> the daily number plus a day
// boundary (in RFC3339, from local midnight to local midnight-next-day —
// same local-time interpretation used to build the string in the first
// place) for looking the order back up. Returns null for anything that
// doesn't parse as a real calendar date.
export function parseSmartOrderNumber(raw: string): { number: number; createdFrom: string; createdTo: string } | null {
  const trimmed = raw.trim();
  const match = /^(\d{2})(\d{2})(\d{2})-(\d{3,})$/.exec(trimmed);
  if (!match) return null;

  const [, yy, mm, dd, nnn] = match;
  const year = 2000 + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const number = Number(nnn);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const from = new Date(year, month - 1, day, 0, 0, 0, 0);
  const to = new Date(year, month - 1, day, 23, 59, 59, 999);
  // Guards against e.g. "260231" (Feb 31st) silently rolling over to March.
  if (from.getMonth() !== month - 1 || from.getDate() !== day) return null;

  return { number, createdFrom: from.toISOString(), createdTo: to.toISOString() };
}

// The order-status page's URL packs everything into one path segment:
// "YYMMDD-NNN-PHONEDIGITS" (the smart order number, itself already
// dash-separated, plus the digits-only phone it was placed under). Splits
// that back apart and resolves the date part the same way
// parseSmartOrderNumber does. Returns null if the key doesn't parse or the
// phone part looks too short to be real.
export function parseOrderStatusKey(raw: string): { number: number; phone: string; createdFrom: string; createdTo: string } | null {
  const parts = raw.trim().split('-');
  if (parts.length < 3) return null;

  const smart = parseSmartOrderNumber(`${parts[0]}-${parts[1]}`);
  if (!smart) return null;

  const phone = parts.slice(2).join('-');
  if (phone.replace(/\D/g, '').length < 10) return null;

  return { ...smart, phone };
}
