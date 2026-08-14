// Category.availableFrom/availableTo/availableDays restrict a catalog
// category to a daily time window and/or specific weekdays (e.g.
// "Breakfast" only 08:00-12:00, "Business lunch" only weekdays) --
// mirrors utils/workingHours.ts's isOpenNow but for a single from/to
// window plus an explicit weekday list, rather than per-day open/close.

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// availableDays is a raw JSON array of ISO weekday numbers (1=Mon..7=Sun),
// matching the backend's storage format -- JS Date.getDay() is 0=Sun..6=Sat.
function isoWeekday(d: Date): number {
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function isCategoryAvailableNow(
  category: { availableFrom?: string | null; availableTo?: string | null; availableDays?: string | null },
  now: Date = new Date()
): boolean {
  if (category.availableDays) {
    try {
      const days = JSON.parse(category.availableDays);
      if (Array.isArray(days) && days.length > 0 && !days.includes(isoWeekday(now))) {
        return false;
      }
    } catch {
      // Malformed JSON -- treat as "no day restriction" rather than hiding
      // the category over a data glitch.
    }
  }

  if (category.availableFrom && category.availableTo && category.availableFrom !== category.availableTo) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const from = toMinutes(category.availableFrom);
    const to = toMinutes(category.availableTo);
    if (to > from) {
      if (nowMin < from || nowMin >= to) return false;
    } else {
      // Overnight window (e.g. 22:00-02:00).
      if (nowMin < from && nowMin >= to) return false;
    }
  }

  return true;
}
