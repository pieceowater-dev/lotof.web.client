import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface FunnelStageInput {
  key: string;
  isTerminal: boolean;
  outcome?: string; // "" | "won" | "lost"
}

export interface FunnelStageMetric {
  statusKey: string;
  enteredCount: number;
  currentCount: number;
  avgDwellSeconds: number;
}

export interface FunnelWeeklyPoint {
  weekStart: string;
  created: number;
  won: number;
  wonAmount: number;
}

export interface FunnelAnalyticsResponse {
  totalDeals: number;
  stages: FunnelStageMetric[];
  wonCount: number;
  lostCount: number;
  openCount: number;
  closedOtherCount: number;
  avgWonCycleSeconds: number;
  medianWonCycleSeconds: number;
  avgLostCycleSeconds: number;
  avgOpenAgeSeconds: number;
  totalDealAmount: number;
  wonDealAmount: number;
  openDealAmount: number;
  weekly: FunnelWeeklyPoint[];
}

const FunnelAnalyticsDocument = /* GraphQL */ `
  query FunnelAnalytics($boardId: ID!, $from: String, $to: String, $stages: [FunnelStageInput!]!) {
    funnelAnalytics(boardId: $boardId, from: $from, to: $to, stages: $stages) {
      totalDeals
      stages { statusKey enteredCount currentCount avgDwellSeconds }
      wonCount lostCount openCount closedOtherCount
      avgWonCycleSeconds medianWonCycleSeconds avgLostCycleSeconds avgOpenAgeSeconds
      totalDealAmount wonDealAmount openDealAmount
      weekly { weekStart created won wonAmount }
    }
  }
`;

export async function tasksFunnelAnalytics(
  tasksToken: string,
  namespaceSlug: string,
  boardId: string,
  stages: FunnelStageInput[],
  from?: string,
  to?: string,
): Promise<FunnelAnalyticsResponse> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ funnelAnalytics: FunnelAnalyticsResponse }>(
      FunnelAnalyticsDocument,
      { boardId, from: from || null, to: to || null, stages },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.funnelAnalytics;
  }, namespaceSlug);
}
