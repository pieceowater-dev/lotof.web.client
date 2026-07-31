import type { ComputedRef } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { getPlanLimits } from '@/api/atrace/plans/getLimits';
import { logError } from '@/utils/logger';
import type { PlanLimits } from '@/types/atrace';

function parseLimitsJson(raw?: string | null): PlanLimits {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (typeof data.max_posts === 'number' || typeof data.max_employees === 'number') {
      return {
        max_posts: typeof data.max_posts === 'number' ? data.max_posts : undefined,
        max_employees: typeof data.max_employees === 'number' ? data.max_employees : undefined,
      };
    }
    if (Array.isArray(data.features)) {
      const result: PlanLimits = {};
      for (const f of data.features) {
        if (f?.key === 'max_posts') result.max_posts = Number(f.value);
        if (f?.key === 'max_employees') result.max_employees = Number(f.value);
      }
      return result;
    }
  } catch {}
  return {};
}

export function useAtracePlanLimits(nsSlug: ComputedRef<string>) {
  const planLimits = ref<PlanLimits | null>(null);
  const planName = ref<string>('');
  const planLimitsLoading = ref(false);

  async function loadPlanLimits() {
    planLimitsLoading.value = true;
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      const res = await getPlanLimits(nsSlug.value, 'pieceowater.atrace', hubToken);
      planName.value = res?.planName || '';
      planLimits.value = parseLimitsJson(res?.limitsJson);
    } catch (err) {
      logError('[useAtracePlanLimits] loadPlanLimits failed', err);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
    }
  }

  // undefined limit = unlimited (no cap configured for this plan/feature).
  function isAtLimit(key: keyof PlanLimits, currentCount: number): boolean {
    const limit = planLimits.value?.[key];
    return typeof limit === 'number' && currentCount >= limit;
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits, isAtLimit };
}
