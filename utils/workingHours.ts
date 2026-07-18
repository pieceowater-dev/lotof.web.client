// Branch.workingHours is a plain string end-to-end (backend never parses
// it) — this file defines the JSON structure we serialize into that string,
// entirely a frontend convention so no backend/proto change was needed.
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayHours = { closed: boolean; open: string; close: string };
export type WorkingHours = Record<DayKey, DayHours>;

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultWorkingHours(): WorkingHours {
  const day = (): DayHours => ({ closed: false, open: '09:00', close: '21:00' });
  return { mon: day(), tue: day(), wed: day(), thu: day(), fri: day(), sat: day(), sun: day() };
}

export function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (DAY_KEYS.every((k) => parsed[k] && typeof parsed[k].closed === 'boolean')) return parsed as WorkingHours;
    return null;
  } catch {
    return null;
  }
}

export function serializeWorkingHours(wh: WorkingHours): string {
  return JSON.stringify(wh);
}

function dayKeyForDate(d: Date): DayKey {
  // getDay(): 0=Sun..6=Sat — rotate so Monday is first, matching DAY_KEYS.
  return DAY_KEYS[(d.getDay() + 6) % 7];
}

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Whether the branch is open at `now`, given its working hours. Supports
// overnight ranges (close < open, e.g. open 18:00 close 02:00) by treating
// them as spilling into the next calendar day.
export function isOpenNow(wh: WorkingHours, now: Date = new Date()): boolean {
  const todayKey = dayKeyForDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = wh[todayKey];
  if (today && !today.closed) {
    const open = minutesSinceMidnight(today.open);
    const close = minutesSinceMidnight(today.close);
    if (close > open) {
      if (nowMin >= open && nowMin < close) return true;
    } else if (close < open) {
      // Overnight: open today through to `close` tomorrow morning.
      if (nowMin >= open) return true;
    }
  }
  // Still within yesterday's overnight window that spills past midnight?
  const yesterday = wh[DAY_KEYS[(DAY_KEYS.indexOf(todayKey) + 6) % 7]];
  if (yesterday && !yesterday.closed) {
    const open = minutesSinceMidnight(yesterday.open);
    const close = minutesSinceMidnight(yesterday.close);
    if (close < open && nowMin < close) return true;
  }
  return false;
}

// A short "opens <day> at HH:MM" label for the next time the branch opens,
// starting the search from `now` (today included) — used for the storefront
// closed-notice. Returns null if every day is marked closed.
export function nextOpenLabel(wh: WorkingHours, now: Date = new Date(), dayLabels: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}, todayLabel = 'today', tomorrowLabel = 'tomorrow'): { day: string; time: string } | null {
  const todayIdx = DAY_KEYS.indexOf(dayKeyForDate(now));
  for (let offset = 0; offset < 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const key = DAY_KEYS[idx];
    const day = wh[key];
    if (!day || day.closed) continue;
    if (offset === 0) {
      // Today — only counts if opening time hasn't already passed.
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (minutesSinceMidnight(day.open) > nowMin) return { day: todayLabel, time: day.open };
      continue;
    }
    return { day: offset === 1 ? tomorrowLabel : dayLabels[key], time: day.open };
  }
  return null;
}
