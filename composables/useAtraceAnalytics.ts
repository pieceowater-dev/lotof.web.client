import type { ComputedRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';

// "Как дела" analytics for the attendance area -- trends and per-member
// patterns a manager would otherwise have to eyeball out of the raw stats
// table (or ask someone to dig out of the DB). Built entirely on two
// already-deployed queries -- getAllUsersStats (per-member aggregates,
// current + previous equal-length period for deltas) and
// exportDailyAttendance (per-day rows, for arrival times and the
// "checked in, never checked out" signal) -- so there's no backend piece.
// Salary is deliberately out of scope here.

export type AnalyticsInsightKind =
  | 'no-show'
  | 'no-checkout'
  | 'frequently-late'
  | 'frequently-early'
  | 'low-attendance';

export type AnalyticsInsight = {
  userId: string;
  name: string;
  kind: AnalyticsInsightKind;
  detail: string;
  severity: number; // higher = surface first
};

export type ArrivalBucket = { label: string; count: number; pct: number };

export type Kpi = {
  // 0..1 for rates, raw hours for avgHoursPerDay
  value: number;
  // percentage-point change vs the previous equal-length period, or null
  // when that period had nothing to compare against
  delta: number | null;
};

export type AttendanceAnalyticsData = {
  memberCount: number;
  attendedDays: number;
  requiredDays: number;
  attendanceRate: Kpi;
  avgHoursPerDay: Kpi;
  lateRate: Kpi;
  earlyLeaveRate: Kpi;
  geoConfirmRate: Kpi;
  openShiftRate: Kpi; // days someone checked in but never closed the shift
  arrivalBuckets: ArrivalBucket[];
  medianArrival: string | null;
  insights: AnalyticsInsight[];
};

type UsersStatsRow = {
  userId: string;
  username?: string;
  workDays: number;
  attendedDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
  lateDays: number;
  earlyLeaveDays: number;
  geoConfirmedDays: number;
  hasScheduleAssignment: boolean;
};

type DailyRow = {
  userId: string;
  username: string;
  date: string;
  firstCheckIn: number;
  lastCheckOut: number;
  workedHours: number;
  attended: boolean;
  legitimate: boolean;
  late: boolean;
  earlyLeave: boolean;
  timezone?: string;
};

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z').getTime();
  const b = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Local minutes-since-midnight of a unix-seconds instant, read in tz.
function localMinutes(unixSec: number, tz?: string): number | null {
  if (!unixSec) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz || undefined,
    }).formatToParts(new Date(unixSec * 1000));
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h % 24) * 60 + m;
  } catch {
    return null;
  }
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rate(numer: number, denom: number): number {
  return denom > 0 ? numer / denom : 0;
}

export function useAtraceAnalytics(nsSlug: ComputedRef<string>) {
  const { t } = useI18n();

  const data = ref<AttendanceAnalyticsData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(startDate: string, endDate: string, postId?: string | null) {
    loading.value = true;
    error.value = null;
    try {
      const periodLen = daysBetweenInclusive(startDate, endDate);
      const prevEnd = shiftDate(startDate, -1);
      const prevStart = shiftDate(prevEnd, -(periodLen - 1));

      const { atraceGetAllUsersStats, atraceExportDailyAttendance } = await import('@/api/atrace/attendance/stats');

      const [curStats, prevStats, dailyRows] = await Promise.all([
        atraceGetAllUsersStats(startDate, endDate, postId ?? null, nsSlug.value) as Promise<UsersStatsRow[]>,
        atraceGetAllUsersStats(prevStart, prevEnd, postId ?? null, nsSlug.value).catch(() => [] as UsersStatsRow[]) as Promise<UsersStatsRow[]>,
        atraceExportDailyAttendance(startDate, endDate, nsSlug.value).catch(() => [] as DailyRow[]) as Promise<DailyRow[]>,
      ]);

      data.value = compute(curStats, prevStats, dailyRows);
    } catch (e: unknown) {
      logError('[useAtraceAnalytics] load failed', e);
      error.value = t('app.analyticsLoadFailed') || 'Не удалось загрузить аналитику';
      data.value = null;
    } finally {
      loading.value = false;
    }
  }

  function compute(cur: UsersStatsRow[], prev: UsersStatsRow[], daily: DailyRow[]): AttendanceAnalyticsData {
    const sum = (rows: UsersStatsRow[], pick: (r: UsersStatsRow) => number) =>
      rows.reduce((acc, r) => acc + (pick(r) || 0), 0);

    const curReq = sum(cur, (r) => r.workDays);
    const curAtt = sum(cur, (r) => r.attendedDays);
    const curLate = sum(cur, (r) => r.lateDays);
    const curEarly = sum(cur, (r) => r.earlyLeaveDays);
    const curGeo = sum(cur, (r) => r.geoConfirmedDays);
    const curHours = sum(cur, (r) => r.totalWorkedHours);

    const prevReq = sum(prev, (r) => r.workDays);
    const prevAtt = sum(prev, (r) => r.attendedDays);
    const prevLate = sum(prev, (r) => r.lateDays);
    const prevEarly = sum(prev, (r) => r.earlyLeaveDays);
    const prevGeo = sum(prev, (r) => r.geoConfirmedDays);
    const prevHours = sum(prev, (r) => r.totalWorkedHours);

    const kpi = (curN: number, curD: number, prevN: number, prevD: number): Kpi => {
      const value = rate(curN, curD);
      const delta = prevD > 0 ? value - rate(prevN, prevD) : null;
      return { value, delta };
    };

    // "checked in, never closed the shift" -- one scan only, so first ==
    // last, and the day resolved as neither attended nor a justified
    // absence. exportDailyAttendance carries no checkCount, but this
    // signature is unambiguous for the dominant case.
    const perUserAppeared = new Map<string, number>();
    const perUserOpen = new Map<string, number>();
    let totalAppeared = 0;
    let totalOpen = 0;
    const arrivalMins: number[] = [];

    for (const row of daily) {
      if (!row.firstCheckIn) continue;
      totalAppeared++;
      perUserAppeared.set(row.userId, (perUserAppeared.get(row.userId) || 0) + 1);
      const isOpen =
        row.firstCheckIn === row.lastCheckOut && !row.attended && !row.legitimate;
      if (isOpen) {
        totalOpen++;
        perUserOpen.set(row.userId, (perUserOpen.get(row.userId) || 0) + 1);
      }
      const mins = localMinutes(row.firstCheckIn, row.timezone);
      if (mins !== null) arrivalMins.push(mins);
    }

    // Previous-period open-shift rate: derived the same way would need
    // another export call; not worth a second round trip -- openShiftRate
    // just has no delta.
    const openShiftRate: Kpi = {
      value: rate(totalOpen, totalAppeared),
      delta: null,
    };

    // Arrival distribution: 30-min bins across the working morning, with
    // catch-alls on both ends.
    const BIN = 30;
    const FIRST = 6 * 60; // 06:00
    const LAST = 11 * 60; // 11:00 -> last labelled bin is 10:30-11:00
    const bins: ArrivalBucket[] = [];
    bins.push({ label: `${t('app.analyticsArrivalBefore') || 'до'} ${minutesToHHMM(FIRST)}`, count: 0, pct: 0 });
    for (let m = FIRST; m < LAST; m += BIN) {
      bins.push({ label: `${minutesToHHMM(m)}–${minutesToHHMM(m + BIN)}`, count: 0, pct: 0 });
    }
    bins.push({ label: `${t('app.analyticsArrivalAfter') || 'после'} ${minutesToHHMM(LAST)}`, count: 0, pct: 0 });
    const binIndex = (mins: number): number => {
      if (mins < FIRST) return 0;
      if (mins >= LAST) return bins.length - 1;
      return 1 + Math.floor((mins - FIRST) / BIN);
    };
    for (const mins of arrivalMins) bins[binIndex(mins)].count++;
    const arrTotal = arrivalMins.length;
    for (const b of bins) b.pct = arrTotal > 0 ? b.count / arrTotal : 0;

    let medianArrival: string | null = null;
    if (arrivalMins.length) {
      const sorted = [...arrivalMins].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      medianArrival = minutesToHHMM(med);
    }

    // Per-member flags.
    const insights: AnalyticsInsight[] = [];
    for (const r of cur) {
      const name = r.username?.trim() || r.userId.slice(0, 8);
      const appeared = perUserAppeared.get(r.userId) || 0;
      const open = perUserOpen.get(r.userId) || 0;

      if (r.hasScheduleAssignment && r.workDays > 0 && r.attendedDays === 0) {
        insights.push({
          userId: r.userId,
          name,
          kind: 'no-show',
          detail:
            (t('app.analyticsNoShowDetail') || 'ни одной отметки за период, норма') +
            ` ${r.workDays} ` +
            (t('app.analyticsDaysShort') || 'дн.'),
          severity: 100,
        });
        continue; // no point also flagging lateness for someone who never came
      }

      if (appeared >= 3 && rate(open, appeared) >= 0.5) {
        const ratioPct = Math.round(rate(open, appeared) * 100);
        insights.push({
          userId: r.userId,
          name,
          kind: 'no-checkout',
          detail:
            (t('app.analyticsNoCheckoutDetail') || 'не закрыл смену') +
            ` ${open} ${t('app.analyticsOutOf') || 'из'} ${appeared} ` +
            (t('app.analyticsDaysShort') || 'дн.') +
            ` (${ratioPct}%)`,
          severity: 60 + ratioPct / 5,
        });
      }

      if (r.attendedDays >= 3 && rate(r.lateDays, r.attendedDays) >= 0.4) {
        insights.push({
          userId: r.userId,
          name,
          kind: 'frequently-late',
          detail:
            (t('app.analyticsLateDetail') || 'опаздывал') +
            ` ${r.lateDays} ${t('app.analyticsOutOf') || 'из'} ${r.attendedDays} ` +
            (t('app.analyticsDaysShort') || 'дн.'),
          severity: 40 + rate(r.lateDays, r.attendedDays) * 20,
        });
      }

      if (r.attendedDays >= 3 && rate(r.earlyLeaveDays, r.attendedDays) >= 0.4) {
        insights.push({
          userId: r.userId,
          name,
          kind: 'frequently-early',
          detail:
            (t('app.analyticsEarlyDetail') || 'уходил раньше') +
            ` ${r.earlyLeaveDays} ${t('app.analyticsOutOf') || 'из'} ${r.attendedDays} ` +
            (t('app.analyticsDaysShort') || 'дн.'),
          severity: 35 + rate(r.earlyLeaveDays, r.attendedDays) * 20,
        });
      }

      if (
        r.hasScheduleAssignment &&
        r.attendedDays > 0 &&
        r.workDays > 0 &&
        rate(r.attendedDays, r.workDays) < 0.6
      ) {
        const pct = Math.round(rate(r.attendedDays, r.workDays) * 100);
        insights.push({
          userId: r.userId,
          name,
          kind: 'low-attendance',
          detail:
            (t('app.analyticsLowAttendanceDetail') || 'посещаемость') +
            ` ${pct}% (${r.attendedDays} ${t('app.analyticsOutOf') || 'из'} ${r.workDays} ` +
            (t('app.analyticsDaysShort') || 'дн.') +
            `)`,
          severity: 20 + (60 - pct) / 3,
        });
      }
    }
    insights.sort((a, b) => b.severity - a.severity);

    return {
      memberCount: cur.length,
      attendedDays: curAtt,
      requiredDays: curReq,
      attendanceRate: kpi(curAtt, curReq, prevAtt, prevReq),
      avgHoursPerDay: {
        value: rate(curHours, curAtt),
        delta: prevAtt > 0 ? rate(curHours, curAtt) - rate(prevHours, prevAtt) : null,
      },
      lateRate: kpi(curLate, curAtt, prevLate, prevAtt),
      earlyLeaveRate: kpi(curEarly, curAtt, prevEarly, prevAtt),
      geoConfirmRate: kpi(curGeo, curAtt, prevGeo, prevAtt),
      openShiftRate,
      arrivalBuckets: bins,
      medianArrival,
      insights,
    };
  }

  return { data, loading, error, load };
}
