import type { ComputedRef } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { getPlanLimits } from '@/api/atrace/plans/getLimits';
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
      console.log('[loadPlanLimits] Response:', res);
      planName.value = res?.planName || '';
      const limits = parseLimitsJson(res?.limitsJson);
      console.log('[loadPlanLimits] Parsed limits:', limits);
      planLimits.value = limits;
      console.log('[loadPlanLimits] planLimits.value:', planLimits.value);
    } catch (err) {
      console.error('[loadPlanLimits] Error:', err);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
      console.log('[loadPlanLimits] Final state - planLimits:', planLimits.value, 'loading:', planLimitsLoading.value);
    }
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits };
}
