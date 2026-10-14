// Period presets of the Menu reports page: one tap instead of two date pickers.
export type PeriodPreset = 'today' | 'week' | 'month' | 'prevMonth' | 'all';

export const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAY = 86400000;

// The from/to (inclusive, local days) a preset stands for on the given day.
export function presetRange(key: PeriodPreset, now: Date): { from: string; to: string } {
  switch (key) {
    case 'today':
      return { from: isoDay(now), to: isoDay(now) };
    case 'week':
      return { from: isoDay(new Date(now.getTime() - 6 * DAY)), to: isoDay(now) };
    case 'month':
      return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
    case 'prevMonth':
      return { from: isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default:
      return { from: '2020-01-01', to: isoDay(now) };
  }
}

// Which preset (if any) the current dates correspond to.
export function presetOf(from: string, to: string, now: Date): PeriodPreset | '' {
  const keys: PeriodPreset[] = ['today', 'week', 'month', 'prevMonth', 'all'];
  return keys.find((k) => { const r = presetRange(k, now); return r.from === from && r.to === to; }) || '';
}
