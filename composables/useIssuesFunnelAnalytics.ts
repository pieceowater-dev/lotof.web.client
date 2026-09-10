// Funnel analytics for a lota Issues board. The heavy lifting (entered /
// current counts per stage, per-stage average dwell time from the activity
// log, win/loss/cycle/deal-amount aggregation, weekly throughput) runs
// server-side in one call — see lotof.issues.gtw's funnelAnalytics query.
// This composable just forwards the board's columns and shapes the result
// for the view (stage-to-stage conversion is the only thing derived here).
import { useTasksToken } from '@/composables/useTasksToken';
import { logError } from '@/utils/logger';
import type { FunnelStageInput } from '@/api/tasks/analytics';

export interface FunnelStageDef {
  key: string;
  label: string;
  isTerminal: boolean;
  outcome: '' | 'won' | 'lost';
  color?: string;
}

export interface FunnelStageStat {
  key: string;
  label: string;
  color?: string;
  entered: number;
  current: number;
  avgDwellDays: number | null;
  /** entered(this) / entered(previous stage); null for the first stage. */
  conversionFromPrev: number | null;
}

export interface FunnelAnalyticsResult {
  totalDeals: number;
  stages: FunnelStageStat[];
  wonCount: number;
  lostCount: number;
  openCount: number;
  closedOtherCount: number;
  winRate: number | null;
  overallConversion: number | null;
  avgWonCycleDays: number | null;
  medianWonCycleDays: number | null;
  avgLostCycleDays: number | null;
  avgOpenAgeDays: number | null;
  totalDealAmount: number;
  wonDealAmount: number;
  openDealAmount: number;
  weekly: { weekStart: string; created: number; won: number; wonAmount: number }[];
  hasOutcomeMarkers: boolean;
  hasDealAmounts: boolean;
}

const SEC_PER_DAY = 86_400;
const nz = (v: number): number | null => (v > 0 ? v : null);

export function useIssuesFunnelAnalytics() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<FunnelAnalyticsResult | null>(null);

  async function load(nsSlug: string, boardId: string, stageDefs: FunnelStageDef[], periodDays: number | null) {
    loading.value = true;
    error.value = null;
    try {
      const { current } = useTasksToken();
      const token = current();
      if (!token) throw new Error('No tasks token');

      const from = periodDays ? new Date(Date.now() - periodDays * SEC_PER_DAY * 1000).toISOString() : undefined;
      const stages: FunnelStageInput[] = stageDefs.map((s) => ({
        key: s.key,
        isTerminal: s.isTerminal,
        outcome: s.outcome || '',
      }));

      const { tasksFunnelAnalytics } = await import('@/api/tasks/analytics');
      const r = await tasksFunnelAnalytics(token, nsSlug, boardId, stages, from);

      const nonTerminal = stageDefs.filter((s) => !s.isTerminal);
      const byKey = new Map(r.stages.map((s) => [s.statusKey, s]));

      const stats: FunnelStageStat[] = nonTerminal.map((s, i) => {
        const m = byKey.get(s.key);
        const entered = m?.enteredCount ?? 0;
        const prev = i > 0 ? (byKey.get(nonTerminal[i - 1].key)?.enteredCount ?? 0) : null;
        return {
          key: s.key,
          label: s.label,
          color: s.color,
          entered,
          current: m?.currentCount ?? 0,
          avgDwellDays: m && m.avgDwellSeconds > 0 ? m.avgDwellSeconds / SEC_PER_DAY : null,
          conversionFromPrev: i === 0 ? null : prev && prev > 0 ? entered / prev : 0,
        };
      });

      const decided = r.wonCount + r.lostCount;
      const hasOutcomeMarkers = stageDefs.some((s) => s.outcome === 'won' || s.outcome === 'lost');

      result.value = {
        totalDeals: r.totalDeals,
        stages: stats,
        wonCount: r.wonCount,
        lostCount: r.lostCount,
        openCount: r.openCount,
        closedOtherCount: r.closedOtherCount,
        winRate: decided > 0 ? r.wonCount / decided : null,
        overallConversion: hasOutcomeMarkers && r.totalDeals > 0 ? r.wonCount / r.totalDeals : null,
        avgWonCycleDays: nz(r.avgWonCycleSeconds / SEC_PER_DAY),
        medianWonCycleDays: nz(r.medianWonCycleSeconds / SEC_PER_DAY),
        avgLostCycleDays: nz(r.avgLostCycleSeconds / SEC_PER_DAY),
        avgOpenAgeDays: nz(r.avgOpenAgeSeconds / SEC_PER_DAY),
        totalDealAmount: r.totalDealAmount,
        wonDealAmount: r.wonDealAmount,
        openDealAmount: r.openDealAmount,
        weekly: r.weekly,
        hasOutcomeMarkers,
        hasDealAmounts: r.totalDealAmount > 0 || r.openDealAmount > 0 || r.wonDealAmount > 0,
      };
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
