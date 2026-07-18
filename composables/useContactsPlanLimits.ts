// Loads and parses the current namespace's contacts plan limits/features.
import { logError } from '@/utils/logger';
import { getContactsPlanLimits } from '@/api/contacts/plans/getLimits';

export interface ContactsPlanLimitsValue {
  max_clients?: number;
  max_custom_fields?: number;
  max_loyalty_programs?: number;
}

export function parseLimitsJson(raw?: string | null): ContactsPlanLimitsValue {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data?.features)) {
      const limits: ContactsPlanLimitsValue = {};
      for (const feature of data.features) {
        if (feature?.key === 'max_clients') limits.max_clients = Number(feature.value);
        if (feature?.key === 'max_custom_fields') limits.max_custom_fields = Number(feature.value);
        if (feature?.key === 'max_loyalty_programs') limits.max_loyalty_programs = Number(feature.value);
      }
      return limits;
    }
  } catch {
    return {};
  }
  return {};
}

export function useContactsPlanLimits() {
  const planLimits = ref<ContactsPlanLimitsValue | null>(null);
  const planName = ref<string>('');
  const planLimitsLoading = ref(false);

  async function loadPlanLimits(nsSlug: string, hubToken?: string | null) {
    planLimitsLoading.value = true;
    try {
      const res = await getContactsPlanLimits(nsSlug, 'pieceowater.contacts', hubToken);
      planName.value = res?.planName || '';
      planLimits.value = parseLimitsJson(res?.limitsJson);
    } catch (e) {
      logError('Failed to load contacts plan limits:', e);
      planLimits.value = null;
    } finally {
      planLimitsLoading.value = false;
    }
  }

  return { planLimits, planName, planLimitsLoading, loadPlanLimits };
}
