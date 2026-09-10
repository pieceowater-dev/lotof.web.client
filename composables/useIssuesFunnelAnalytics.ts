// Client-side funnel analytics for a lota Issues board. Everything is
// derived from fields ListTasks already returns per task —
// `visitedStatuses` (every column the task ever occupied), `status`,
// `createdAt`, `closedAt` — so there is no dedicated aggregation endpoint.
// Deals are paged in once (capped) and reduced in the browser.
//
// "Won" / "lost" is read from the `outcome` marker on a terminal column
// (set in Board settings, pre-set by the sales-funnel template). Without any
// outcome markers the view still shows the stage funnel and cycle times,
// just not a win rate.
import { useTasksToken } from '@/composables/useTasksToken';
import { logError } from '@/utils/logger';
import type { TaskItem } from '@/api/tasks/task/list';

export interface FunnelStageDef {
  key: string;
  label: string;
  isTerminal: boolean;
  outcome: '' | 'won' | 'lost';
  color?: string;
}

export interface FunnelStageStat extends FunnelStageDef {
  entered: number; // deals whose visitedStatuses includes this key
  current: number; // deals sitting in this column right now
  /** entered(this) / entered(previous non-terminal stage); null for the first. */
  conversionFromPrev: number | null;
}

export interface FunnelAnalyticsResult {
  totalDeals: number;
  stages: FunnelStageStat[]; // non-terminal stages, board order
  wonCount: number;
  lostCount: number;
  openCount: number;
  closedNoOutcomeCount: number;
  winRate: number | null; // won / (won + lost)
  overallConversion: number | null; // won / totalDeals
  avgWonCycleDays: number | null;
  medianWonCycleDays: number | null;
  avgLostCycleDays: number | null;
  avgOpenAgeDays: number | null;
  weekly: { weekStart: string; created: number; won: number }[];
  hasOutcomeMarkers: boolean;
  capped: boolean;
  loadedCount: number;
}

const PAGE_LENGTH = 'ONE_HUNDRED';
const MAX_PAGES = 50; // 5000 deals — beyond this the numbers get a "≈" caveat

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Monday-anchored ISO week start (local time), as YYYY-MM-DD.
function weekStartOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - dow);
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${mm}-${dd}`;
}

export function useIssuesFunnelAnalytics() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<FunnelAnalyticsResult | null>(null);

  async function fetchAllTasks(nsSlug: string, boardId: string, createdFrom?: string): Promise<{ tasks: TaskItem[]; capped: boolean }> {
    const { current } = useTasksToken();
    const token = current();
    if (!token) throw new Error('No tasks token');
    const { tasksBundle } = await import('@/api/tasks/task/list');

    const all: TaskItem[] = [];
    let capped = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await tasksBundle(
        token,
        nsSlug,
        { boardIds: [boardId], ...(createdFrom ? { createdFrom } : {}) },
        { page, length: PAGE_LENGTH },
      );
      all.push(...res.tasks);
      if (res.tasks.length < 100 || all.length >= res.count) break;
      if (page === MAX_PAGES) capped = true;
    }
    return { tasks: all, capped };
  }

  function compute(tasks: TaskItem[], stageDefs: FunnelStageDef[], periodDays: number | null, capped: boolean): FunnelAnalyticsResult {
    const nonTerminal = stageDefs.filter((s) => !s.isTerminal);
    const wonKeys = new Set(stageDefs.filter((s) => s.outcome === 'won').map((s) => s.key));
    const lostKeys = new Set(stageDefs.filter((s) => s.outcome === 'lost').map((s) => s.key));
    const terminalKeys = new Set(stageDefs.filter((s) => s.isTerminal).map((s) => s.key));
    const hasOutcomeMarkers = wonKeys.size > 0 || lostKeys.size > 0;

    const currentByStatus = new Map<string, number>();
    for (const t of tasks) currentByStatus.set(t.status, (currentByStatus.get(t.status) || 0) + 1);

    const enteredByKey = new Map<string, number>();
    for (const t of tasks) {
      const visited = t.visitedStatuses && t.visitedStatuses.length ? t.visitedStatuses : [t.status];
      for (const k of new Set(visited)) enteredByKey.set(k, (enteredByKey.get(k) || 0) + 1);
    }

    const stages: FunnelStageStat[] = nonTerminal.map((s, i) => {
      const entered = enteredByKey.get(s.key) || 0;
      const prevEntered = i > 0 ? (enteredByKey.get(nonTerminal[i - 1].key) || 0) : null;
      return {
        ...s,
        entered,
        current: currentByStatus.get(s.key) || 0,
        conversionFromPrev: prevEntered && prevEntered > 0 ? entered / prevEntered : (i === 0 ? null : 0),
      };
    });

    let wonCount = 0;
    let lostCount = 0;
    let closedNoOutcomeCount = 0;
    const wonCycles: number[] = [];
    const lostCycles: number[] = [];
    const openAges: number[] = [];
    const nowIso = new Date().toISOString();

    for (const t of tasks) {
      if (wonKeys.has(t.status)) {
        wonCount++;
        if (t.closedAt) wonCycles.push(daysBetween(t.createdAt, t.closedAt));
      } else if (lostKeys.has(t.status)) {
        lostCount++;
        if (t.closedAt) lostCycles.push(daysBetween(t.createdAt, t.closedAt));
      } else if (terminalKeys.has(t.status)) {
        closedNoOutcomeCount++;
      } else {
        openAges.push(daysBetween(t.createdAt, nowIso));
      }
    }

    const openCount = tasks.length - wonCount - lostCount - closedNoOutcomeCount;
    const decided = wonCount + lostCount;

    // Weekly trend: last 26 weeks (or the period, whichever is shorter),
    // created by createdAt, won by closedAt.
    const weeks = Math.min(26, periodDays ? Math.ceil(periodDays / 7) : 26);
    const buckets = new Map<string, { created: number; won: number }>();
    const cursor = new Date();
    for (let i = 0; i < weeks; i++) {
      buckets.set(weekStartOf(cursor), { created: 0, won: 0 });
      cursor.setDate(cursor.getDate() - 7);
    }
    for (const t of tasks) {
      const cw = weekStartOf(new Date(t.createdAt));
      if (buckets.has(cw)) buckets.get(cw)!.created++;
      if (wonKeys.has(t.status) && t.closedAt) {
        const ww = weekStartOf(new Date(t.closedAt));
        if (buckets.has(ww)) buckets.get(ww)!.won++;
      }
    }
    const weekly = [...buckets.entries()]
      .map(([weekStart, v]) => ({ weekStart, ...v }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return {
      totalDeals: tasks.length,
      stages,
      wonCount,
      lostCount,
      openCount,
      closedNoOutcomeCount,
      winRate: decided > 0 ? wonCount / decided : null,
      overallConversion: tasks.length > 0 && hasOutcomeMarkers ? wonCount / tasks.length : null,
      avgWonCycleDays: mean(wonCycles),
      medianWonCycleDays: median(wonCycles),
      avgLostCycleDays: mean(lostCycles),
      avgOpenAgeDays: mean(openAges),
      weekly,
      hasOutcomeMarkers,
      capped,
      loadedCount: tasks.length,
    };
  }

  async function load(nsSlug: string, boardId: string, stageDefs: FunnelStageDef[], periodDays: number | null) {
    loading.value = true;
    error.value = null;
    try {
      const createdFrom = periodDays
        ? new Date(Date.now() - periodDays * 86_400_000).toISOString()
        : undefined;
      const { tasks, capped } = await fetchAllTasks(nsSlug, boardId, createdFrom);
      result.value = compute(tasks, stageDefs, periodDays, capped);
    } catch (e) {
      logError('[useIssuesFunnelAnalytics] load failed', e);
      error.value = e instanceof Error ? e.message : 'Failed to load analytics';
      result.value = null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, result, load };
}
