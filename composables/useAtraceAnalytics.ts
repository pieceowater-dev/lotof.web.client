import type { ComputedRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAtraceActiveMembers } from '@/composables/useAtraceActiveMembers';
import { logError } from '@/utils/logger';

// "Как дела" analytics for the attendance area -- trends and per-member
// patterns a manager would otherwise have to eyeball out of the raw stats
// table (or ask someone to dig out of the DB). Built entirely on two
// already-deployed queries -- getAllUsersStats (per-member aggregates,
// current + previous equal-length period) and exportDailyAttendance
// (per-day rows) -- so there's no backend piece. Salary is out of scope.
//
// Every rate here is over DAYS PRESENT (a day with any check-in, counted
// from the export rows), not getAllUsersStats.attendedDays -- "attended"
// there means the day met the full hours requirement, so late/early/geo
// counts (which aren't a subset of it) would produce >100% rates against
// it. Inactive members are filtered out, same as the stats table does.

export type AnalyticsInsightKind =
  | 'no-show'
  | 'no-checkout'
  | 'frequently-late'
  | 'frequently-early'
  | 'low-attendance'
  | 'config-hint';

export type AnalyticsInsight = {
  userId: string;
  name: string;
  kind: AnalyticsInsightKind;
  detail: string;
  severity: number;
};

export type ArrivalBucket = { label: string; count: number; pct: number };

export type Kpi = {
  value: number; // 0..1 for rates, raw hours for avgHoursPerDay
  delta: number | null; // pp change vs previous equal-length period, null if none
};

export type AttendanceAnalyticsData = {
  memberCount: number;
  daysPresent: number;
  requiredDays: number;
  turnoutRate: Kpi; // days present / required days
  avgHoursPerDay: Kpi;
  lateRate: Kpi;
  earlyLeaveRate: Kpi;
  geoConfirmRate: Kpi;
  openShiftRate: Kpi;
  arrivalBuckets: ArrivalBucket[];
  medianArrival: string | null;
  insights: AnalyticsInsight[];
};

type UsersStatsRow = {
  userId: string;
  username?: string;
  workDays: number;
  attendedDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  geoConfirmedDays: number;
  totalWorkedHours: number;
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

// unixMs: exportDailyAttendance returns firstCheckIn/lastCheckOut in
// MILLISECONDS (unlike the per-record/reprocess endpoints, which are in
// seconds) -- keep this in step with that source.
function localMinutes(unixMs: number, tz?: string): number | null {
  if (!unixMs) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz || undefined,
    }).formatToParts(new Date(unixMs));
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

// Number of days in the export set where this person actually checked in
// (any scan). The "open shift" subset: exactly one scan, so first == last,
// and the day resolved as neither attended nor a justified absence.
function presenceFromDaily(rows: DailyRow[]) {
  const present = new Map<string, number>();
  const open = new Map<string, number>();
  const arrivalMins: number[] = [];
  let totalPresent = 0;
  let totalOpen = 0;
  for (const row of rows) {
    if (!row.firstCheckIn) continue;
    totalPresent++;
    present.set(row.userId, (present.get(row.userId) || 0) + 1);
    if (row.firstCheckIn === row.lastCheckOut && !row.attended && !row.legitimate) {
      totalOpen++;
      open.set(row.userId, (open.get(row.userId) || 0) + 1);
    }
    const mins = localMinutes(row.firstCheckIn, row.timezone);
    if (mins !== null) arrivalMins.push(mins);
  }
  return { present, open, arrivalMins, totalPresent, totalOpen };
}

export function useAtraceAnalytics(nsSlug: ComputedRef<string>) {
  const { t } = useI18n();
  const { activeUserIds, loadActiveMembers } = useAtraceActiveMembers(nsSlug);

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

      const [curStats, prevStats, curDaily, prevDaily] = await Promise.all([
        atraceGetAllUsersStats(startDate, endDate, postId ?? null, nsSlug.value) as Promise<UsersStatsRow[]>,
        atraceGetAllUsersStats(prevStart, prevEnd, postId ?? null, nsSlug.value).catch(() => [] as UsersStatsRow[]) as Promise<UsersStatsRow[]>,
        atraceExportDailyAttendance(startDate, endDate, nsSlug.value).catch(() => [] as DailyRow[]) as Promise<DailyRow[]>,
        atraceExportDailyAttendance(prevStart, prevEnd, nsSlug.value).catch(() => [] as DailyRow[]) as Promise<DailyRow[]>,
        loadActiveMembers(),
      ]);

      // If getActiveMembers came back empty (query failed / brand-new
      // namespace) don't filter everything to nothing -- fall back to
      // "keep all".
      const active = activeUserIds.value;
      const keep = (uid: string) => active.size === 0 || active.has(uid);

      data.value = compute(
        curStats.filter((r) => keep(r.userId)),
        prevStats.filter((r) => keep(r.userId)),
        curDaily.filter((r) => keep(r.userId)),
        prevDaily.filter((r) => keep(r.userId)),
      );
    } catch (e: unknown) {
      logError('[useAtraceAnalytics] load failed', e);
      error.value = t('app.analyticsLoadFailed') || 'Не удалось загрузить аналитику';
      data.value = null;
    } finally {
      loading.value = false;
    }
  }

  function compute(cur: UsersStatsRow[], prev: UsersStatsRow[], curDaily: DailyRow[], prevDaily: DailyRow[]): AttendanceAnalyticsData {
    const sum = (rows: UsersStatsRow[], pick: (r: UsersStatsRow) => number) =>
      rows.reduce((acc, r) => acc + (pick(r) || 0), 0);

    const curP = presenceFromDaily(curDaily);
    const prevP = presenceFromDaily(prevDaily);

    const curReq = sum(cur, (r) => r.workDays);
    const prevReq = sum(prev, (r) => r.workDays);
    const curLate = sum(cur, (r) => r.lateDays);
    const prevLate = sum(prev, (r) => r.lateDays);
    const curEarly = sum(cur, (r) => r.earlyLeaveDays);
    const prevEarly = sum(prev, (r) => r.earlyLeaveDays);
    const curGeo = sum(cur, (r) => r.geoConfirmedDays);
    const prevGeo = sum(prev, (r) => r.geoConfirmedDays);
    const curHours = curDaily.reduce((a, r) => a + (r.workedHours || 0), 0);
    const prevHours = prevDaily.reduce((a, r) => a + (r.workedHours || 0), 0);

    const kpi = (curN: number, curD: number, prevN: number, prevD: number): Kpi => {
      const value = rate(curN, curD);
      const delta = prevD > 0 ? value - rate(prevN, prevD) : null;
      return { value, delta };
    };

    const openShiftRate = kpi(curP.totalOpen, curP.totalPresent, prevP.totalOpen, prevP.totalPresent);

    // Arrival distribution: 30-min bins across the working morning, with
    // catch-alls on both ends.
    const BIN = 30;
    const FIRST = 6 * 60;
    const LAST = 11 * 60;
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
    for (const mins of curP.arrivalMins) bins[binIndex(mins)].count++;
    const arrTotal = curP.arrivalMins.length;
    for (const b of bins) b.pct = arrTotal > 0 ? b.count / arrTotal : 0;

    let medianArrival: string | null = null;
    if (curP.arrivalMins.length) {
      const sorted = [...curP.arrivalMins].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      medianArrival = minutesToHHMM(med);
    }

    // Namespace-wide rates, used to decide whether a per-member late/early
    // flag is actually an individual pattern or just everyone tripping a
    // threshold that doesn't match this workplace's real shift.
    const nsLateRate = rate(curLate, curP.totalPresent);
    const nsEarlyRate = rate(curEarly, curP.totalPresent);
    const nsGeoRate = rate(curGeo, curP.totalPresent);
    const lateIsIndividual = nsLateRate < 0.3;
    const earlyIsIndividual = nsEarlyRate < 0.4;

    // Per-member flags.
    const insights: AnalyticsInsight[] = [];

    if (!earlyIsIndividual && curP.totalPresent > 0) {
      insights.push({
        userId: '', name: '', kind: 'config-hint',
        detail:
          `${t('app.analyticsEarlyThresholdHint') || 'Ранние уходы срабатывают почти у всех'} (${Math.round(nsEarlyRate * 100)}%) — ` +
          (t('app.analyticsEarlyThresholdHint2') || 'скорее всего, порог раннего ухода не совпадает с реальным концом смены; проверьте настройки посещаемости'),
        severity: 5,
      });
    }
    if (curP.totalPresent >= 10 && nsGeoRate < 0.1) {
      insights.push({
        userId: '', name: '', kind: 'config-hint',
        detail:
          `${t('app.analyticsGeoHint') || 'Гео-подтверждение почти не собирается'} (${Math.round(nsGeoRate * 100)}%) — ` +
          (t('app.analyticsGeoHint2') || 'большинство сотрудников не дали браузеру доступ к геолокации'),
        severity: 4,
      });
    }

    for (const r of cur) {
      const name = r.username?.trim() || r.userId.slice(0, 8);
      const daysPresent = curP.present.get(r.userId) || 0;
      const open = curP.open.get(r.userId) || 0;
      const D = (n: number) => `${n} ${t('app.analyticsOutOf') || 'из'}`;
      const dd = t('app.analyticsDaysShort') || 'дн.';

      if (r.hasScheduleAssignment && r.workDays > 0 && daysPresent === 0) {
        insights.push({
          userId: r.userId, name, kind: 'no-show',
          detail: `${t('app.analyticsNoShowDetail') || 'ни одной отметки за период, норма'} ${r.workDays} ${dd}`,
          severity: 100,
        });
        continue;
      }

      if (daysPresent >= 3 && rate(open, daysPresent) >= 0.5) {
        const ratioPct = Math.round(rate(open, daysPresent) * 100);
        insights.push({
          userId: r.userId, name, kind: 'no-checkout',
          detail: `${t('app.analyticsNoCheckoutDetail') || 'не закрыл смену'} ${D(open)} ${daysPresent} ${dd} (${ratioPct}%)`,
          severity: 60 + ratioPct / 5,
        });
      }

      if (lateIsIndividual && daysPresent >= 3 && rate(r.lateDays, daysPresent) >= 0.4) {
        insights.push({
          userId: r.userId, name, kind: 'frequently-late',
          detail: `${t('app.analyticsLateDetail') || 'опаздывал'} ${D(r.lateDays)} ${daysPresent} ${dd}`,
          severity: 40 + rate(r.lateDays, daysPresent) * 20,
        });
      }

      if (earlyIsIndividual && daysPresent >= 3 && rate(r.earlyLeaveDays, daysPresent) >= 0.4) {
        insights.push({
          userId: r.userId, name, kind: 'frequently-early',
          detail: `${t('app.analyticsEarlyDetail') || 'уходил раньше'} ${D(r.earlyLeaveDays)} ${daysPresent} ${dd}`,
          severity: 35 + rate(r.earlyLeaveDays, daysPresent) * 20,
        });
      }

      if (r.hasScheduleAssignment && daysPresent > 0 && r.workDays > 0 && rate(daysPresent, r.workDays) < 0.6) {
        const p = Math.round(rate(daysPresent, r.workDays) * 100);
        insights.push({
          userId: r.userId, name, kind: 'low-attendance',
          detail: `${t('app.analyticsLowAttendanceDetail') || 'посещаемость'} ${p}% (${D(daysPresent)} ${r.workDays} ${dd})`,
          severity: 20 + (60 - p) / 3,
        });
      }
    }
    insights.sort((a, b) => b.severity - a.severity);

    return {
      memberCount: cur.length,
      daysPresent: curP.totalPresent,
      requiredDays: curReq,
      turnoutRate: kpi(curP.totalPresent, curReq, prevP.totalPresent, prevReq),
      avgHoursPerDay: {
        value: rate(curHours, curP.totalPresent),
        delta: prevP.totalPresent > 0 ? rate(curHours, curP.totalPresent) - rate(prevHours, prevP.totalPresent) : null,
      },
      lateRate: kpi(curLate, curP.totalPresent, prevLate, prevP.totalPresent),
      earlyLeaveRate: kpi(curEarly, curP.totalPresent, prevEarly, prevP.totalPresent),
      geoConfirmRate: kpi(curGeo, curP.totalPresent, prevGeo, prevP.totalPresent),
      openShiftRate,
      arrivalBuckets: bins,
      medianArrival,
      insights,
    };
  }

  return { data, loading, error, load };
}
