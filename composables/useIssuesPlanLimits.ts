// Loads and parses the current namespace's Issues plan limits/features --
// mirrors useMenuPlanLimits/useContactsPlanLimits, but reads Issues' own
// feature keys and authenticates with an issues app token.
import { logError } from '@/utils/logger';
import { tasksPlanLimits } from '@/api/tasks/plans/getLimits';

export interface IssuesPlanLimitsValue {
  max_boards?: number;
  max_staff?: number;
}

const LIMIT_KEYS: (keyof IssuesPlanLimitsValue)[] = ['max_boards', 'max_staff'];

export function parseIssuesLimitsJson(raw?: string | null): IssuesPlanLimitsValue {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.features)) return {};
    const limits: IssuesPlanLimitsValue = {};
    for (const feature of data.features) {
      if (LIMIT_KEYS.includes(feature?.key)) limits[feature.key as keyof IssuesPlanLimitsValue] = Number(feature.value);
    }
    return limits;
  } catch {
    return {};
  }
}

export function useIssuesPlanLimits() {
  const planLimits = ref<IssuesPlanLimitsValue | null>(null);
  const planName = ref('');
  const planLimitsLoading = ref(false);

  async function loadPlanLimits(tasksToken: string, nsSlug: string) {
    planLimitsLoading.value = true;
    try {
      const res = await tasksPlanLimits(tasksToken, nsSlug);
      planName.value = res?.planName || '';
      planLimits.value = parseIssuesLimitsJson(res?.limitsJson);
    } catch (e) {
      logError('[useIssuesPlanLimits] loadPlanLimits failed', e);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
    }
  }

  // undefined limit = unlimited (no cap configured for this plan/feature).
  function isAtLimit(key: keyof IssuesPlanLimitsValue, currentCount: number): boolean {
    const limit = planLimits.value?.[key];
    return typeof limit === 'number' && currentCount >= limit;
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits, isAtLimit };
}
