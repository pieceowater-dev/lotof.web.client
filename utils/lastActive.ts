// Shared formatting for a namespace's `lastActiveAt` (the newest hub-session
// activity across its owner and members -- see hub.gtw's attachActivity).
// Used by the console analytics and namespaces admin views so "was this
// namespace active recently" reads the same in both places.

const DAY_MS = 24 * 60 * 60 * 1000;

// A stable "now" is passed in (captured once when the page's data loads) so
// every row on a page agrees instead of each drifting with Date.now().
export function relativeLastActive(iso: string | null | undefined, now: number): string {
  if (!iso) return 'нет данных';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const diff = Math.max(0, now - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} мес назад`;
  return `${Math.floor(months / 12)} г назад`;
}

// Traffic-light dot: green within 24h, amber within a week, grey older or
// unknown.
export function lastActiveDotClass(iso: string | null | undefined, now: number): string {
  if (!iso) return 'bg-slate-300 dark:bg-slate-700';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'bg-slate-300 dark:bg-slate-700';
  const age = now - ms;
  if (age <= DAY_MS) return 'bg-emerald-500';
  if (age <= 7 * DAY_MS) return 'bg-amber-500';
  return 'bg-slate-400 dark:bg-slate-600';
}

// True when the namespace had activity within `windowMs` of `now`.
export function activeWithin(iso: string | null | undefined, now: number, windowMs: number): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  return !Number.isNaN(ms) && now - ms <= windowMs;
}
