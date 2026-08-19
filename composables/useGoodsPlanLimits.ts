// Loads and parses the current namespace's goods plan limits/features --
// mirrors useMenuPlanLimits, but reads Goods' own feature keys and
// authenticates with a goods app token (GoodsAuthorization) since
// getPlanLimits is @goodsAuth on this gateway.
import { logError } from '@/utils/logger';
import { getGoodsPlanLimits } from '@/api/goods/plans/getLimits';

export interface GoodsPlanLimitsValue {
  max_staff?: number;
  max_warehouses?: number;
  max_registers?: number;
  max_goods?: number;
}

const LIMIT_KEYS: (keyof GoodsPlanLimitsValue)[] = [
  'max_staff', 'max_warehouses', 'max_registers', 'max_goods',
];

export function parseGoodsLimitsJson(raw?: string | null): GoodsPlanLimitsValue {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.features)) return {};
    const limits: GoodsPlanLimitsValue = {};
    for (const feature of data.features) {
      if (LIMIT_KEYS.includes(feature?.key)) limits[feature.key as keyof GoodsPlanLimitsValue] = Number(feature.value);
    }
    return limits;
  } catch {
    return {};
  }
}

export function useGoodsPlanLimits() {
  const planLimits = ref<GoodsPlanLimitsValue | null>(null);
  const planName = ref('');
  const planLimitsLoading = ref(false);

  async function loadPlanLimits(goodsToken: string, nsSlug: string) {
    planLimitsLoading.value = true;
    try {
      const res = await getGoodsPlanLimits(goodsToken, nsSlug);
      planName.value = res?.planName || '';
      planLimits.value = parseGoodsLimitsJson(res?.limitsJson);
    } catch (e) {
      logError('[useGoodsPlanLimits] loadPlanLimits failed', e);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
    }
  }

  // undefined limit = unlimited (no cap configured for this plan/feature).
  function isAtLimit(key: keyof GoodsPlanLimitsValue, currentCount: number): boolean {
    const limit = planLimits.value?.[key];
    return typeof limit === 'number' && currentCount >= limit;
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits, isAtLimit };
}
