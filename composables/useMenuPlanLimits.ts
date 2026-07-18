// Loads and parses the current namespace's menu plan limits/features —
// mirrors useContactsPlanLimits, but reads Menu's own feature keys and
// authenticates with a menu app token (MenuAuthorization) since
// getPlanLimits is @menuAuth on this gateway, not @hubAuth like Contacts'.
import { logError } from '@/utils/logger';
import { getMenuPlanLimits } from '@/api/menu/plans/getLimits';

export interface MenuPlanLimitsValue {
  max_staff?: number;
  max_branches?: number;
  max_menu_items?: number;
  max_promobanners?: number;
  max_badges?: number;
  max_links?: number;
}

const LIMIT_KEYS: (keyof MenuPlanLimitsValue)[] = [
  'max_staff', 'max_branches', 'max_menu_items', 'max_promobanners', 'max_badges', 'max_links',
];

export function parseMenuLimitsJson(raw?: string | null): MenuPlanLimitsValue {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.features)) return {};
    const limits: MenuPlanLimitsValue = {};
    for (const feature of data.features) {
      if (LIMIT_KEYS.includes(feature?.key)) limits[feature.key as keyof MenuPlanLimitsValue] = Number(feature.value);
    }
    return limits;
  } catch {
    return {};
  }
}

export function useMenuPlanLimits() {
  const planLimits = ref<MenuPlanLimitsValue | null>(null);
  const planName = ref('');
  const planLimitsLoading = ref(false);

  async function loadPlanLimits(menuToken: string, nsSlug: string) {
    planLimitsLoading.value = true;
    try {
      const res = await getMenuPlanLimits(menuToken, nsSlug);
      planName.value = res?.planName || '';
      planLimits.value = parseMenuLimitsJson(res?.limitsJson);
    } catch (e) {
      logError('[useMenuPlanLimits] loadPlanLimits failed', e);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
    }
  }

  // undefined limit = unlimited (no cap configured for this plan/feature).
  function isAtLimit(key: keyof MenuPlanLimitsValue, currentCount: number): boolean {
    const limit = planLimits.value?.[key];
    return typeof limit === 'number' && currentCount >= limit;
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits, isAtLimit };
}
