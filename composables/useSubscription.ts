import { ref, computed } from 'vue';
import type { PlanLimits, SubscriptionStatus } from '@/api/atrace/subscription/plan';
import { atraceGetPlanLimits } from '@/api/atrace/subscription/plan';
import { useAuth } from '@/composables/useAuth';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useRoute } from 'vue-router';

export interface UseSubscriptionOptions {
  appBundle: string;
  namespaceSlug?: string;
}

export function useSubscription(options: UseSubscriptionOptions) {
  const planLimits = ref<PlanLimits | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isSubscriptionActive = computed(() => {
    return planLimits.value?.isSubscriptionActive ?? false;
  });

  const subscriptionStatus = computed(() => {
    return planLimits.value?.subscriptionStatus;
  });

  const planCode = computed(() => {
    return planLimits.value?.planCode ?? '';
  });

  const planName = computed(() => {
    return planLimits.value?.planName ?? '';
  });

  const trialEndsAt = computed(() => {
    return planLimits.value?.trialEndsAt;
  });

  const currentPeriodEnd = computed(() => {
    return planLimits.value?.currentPeriodEnd;
  });

  const isExpired = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_EXPIRED';
  });

  const isPastDue = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_PAST_DUE';
  });

  const isTrialing = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_TRIALING';
  });

  const isActive = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_ACTIVE';
  });

  const isCanceled = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_CANCELED';
  });

  const isIncomplete = computed(() => {
    return subscriptionStatus.value === 'SUBSCRIPTION_INCOMPLETE';
  });

  /**
   * Fetch plan limits for the app bundle.
   * Automatically uses tokens from auth store and cookies.
   * Uses namespaceSlug from options, or tries to get from route.
   */
  const fetchPlanLimits = async () => {
    loading.value = true;
    error.value = null;
    try {
      const auth = useAuth();
      const atraceTokenComposable = useAtraceToken();
      
      const hubToken = auth.token.value;
      const atToken = atraceTokenComposable.current();
      
      // Get namespace from options or route
      let namespaceSlug = options.namespaceSlug;
      if (!namespaceSlug) {
        try {
          const route = useRoute();
          namespaceSlug = route.params.namespace as string;
        } catch {}
      }
      
      if (!hubToken) {
        throw new Error('Hub token is missing. Please login first.');
      }
      if (!atToken) {
        throw new Error('Atrace token is missing. Please authenticate with atrace.');
      }
      if (!namespaceSlug) {
        throw new Error('Namespace slug is missing. Pass it via options or navigate to a namespace route.');
      }

      planLimits.value = await atraceGetPlanLimits(atToken, hubToken, options.appBundle, namespaceSlug);
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch plan limits';
      console.error('useSubscription: fetchPlanLimits error', e);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Refresh plan limits (refetch).
   */
  const refresh = async () => {
    await fetchPlanLimits();
  };

  /**
   * Reset subscription state.
   */
  const reset = () => {
    planLimits.value = null;
    error.value = null;
  };

  return {
    // State
    planLimits,
    loading,
    error,

    // Computed
    isSubscriptionActive,
    subscriptionStatus,
    planCode,
    planName,
    trialEndsAt,
    currentPeriodEnd,

    // Status flags
    isExpired,
    isPastDue,
    isTrialing,
    isActive,
    isCanceled,
    isIncomplete,

    // Methods
    fetchPlanLimits,
    refresh,
    reset,
  };
}
