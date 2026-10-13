/**
 * Dates from the services arrive as RFC3339; some older responses carried Go's
 * debug format ("2026-10-08 10:56:14.97892 +0000 +0000"). Both are read here.
 */
export function parseLooseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?\s*([+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const zone = m[4] ? (m[4].includes(':') ? m[4] : `${m[4].slice(0, 3)}:${m[4].slice(3)}`) : 'Z';
  const d = new Date(`${m[1]}T${m[2]}${(m[3] || '').slice(0, 4)}${zone}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(raw?: string | null, locale?: string): string {
  const d = parseLooseDate(raw);
  if (!d) return raw || '';
  return d.toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateOnly(raw?: string | null, locale?: string): string {
  const d = parseLooseDate(raw);
  if (!d) return raw || '';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
