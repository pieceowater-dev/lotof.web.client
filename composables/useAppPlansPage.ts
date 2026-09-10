import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { useDowngradeBlockedModal, parseDowngradeRegressions } from '@/composables/useDowngradeBlockedModal';
import { getErrorMessage } from '@/utils/types/errors';
import { isSafeRelativePath } from '@/utils/safeRelativePath';

// The five per-app plan pages (issues / atrace / menu / goods / contacts) are
// the same screen with different data sources. This composable owns the whole
// flow -- load, interval toggle, auto-provision the free tier, redirect back
// after a returnTo, the contact-sales / phone-gate / downgrade-blocked
// branching on subscribe, app installation, analytics -- and each page just
// hands it an adapter (below) that speaks to its own gateway.

export interface AppPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: string;
  interval: 'MONTH' | 'YEAR' | string;
  amountCents: number;
  trialDays: number;
  metadataJson?: string | null;
}

// Normalised across apps -- pages map their own subscription shape onto this
// (e.g. trialEndDate -> trialEndsAt) before returning it.
export interface AppSubscription {
  planId: string;
  planCode?: string | null;
  status?: string | null;
  trialEndsAt?: string | null;
  interval?: 'MONTH' | 'YEAR' | string | null;
}

export interface AppPlanFeature {
  key: string;
  value: number | string;
  label?: string;
}

export interface AppPlansTokenApi {
  ensure: (nsSlug: string, hubToken?: string | null) => Promise<string | null>;
  current: () => string | null;
}

export interface AppPlansPageConfig {
  /** e.g. "pieceowater.issues" */
  appBundle: string;
  /** URL segment for the default returnTo, e.g. "issues" -> /{ns}/issues */
  appKey: string;
  /** document title */
  title: string;
  token: AppPlansTokenApi;
  loadPlans: (nsSlug: string) => Promise<{ plans: AppPlan[] }>;
  loadActiveSubscription: (args: {
    nsSlug: string;
    hubToken: string;
    appToken: string;
  }) => Promise<AppSubscription | null>;
  subscribe: (args: {
    nsSlug: string;
    hubToken: string;
    appToken: string;
    planCode: string;
  }) => Promise<AppSubscription | null | void>;
}

export function useAppPlansPage(config: AppPlansPageConfig) {
  const { t } = useI18n();
  const router = useRouter();
  const route = useRoute();
  const toast = useToast();
  const nsSlug = computed(() => route.params.namespace as string);

  useHead({ title: config.title });

  const hubToken = () => useCookie<string | null>('token', { path: '/' }).value;

  const plans = ref<AppPlan[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedInterval = ref<'monthly' | 'yearly'>('monthly');
  const subscribingPlanCode = ref<string | null>(null);
  const activeSubscription = ref<AppSubscription | null>(null);
  const redirectingAfterReturn = ref(false);
  // Set when loadActiveSubscription() throws -- distinguishes "confirmed no
  // subscription" from "couldn't tell", so a transient fetch error can't make
  // autoSelectFreePlanIfNeeded() treat an already-paying namespace as if it
  // had nothing active and silently provision/downgrade it to the free tier.
  const subscriptionFetchFailed = ref(false);

  const monthlyPlans = computed(() => plans.value.filter((p) => p.interval === 'MONTH'));
  const yearlyPlans = computed(() => plans.value.filter((p) => p.interval === 'YEAR'));
  const displayedPlans = computed(() =>
    selectedInterval.value === 'monthly' ? monthlyPlans.value : yearlyPlans.value,
  );

  function goBack() {
    if (import.meta.client) {
      window.history.back();
      return;
    }
    router.back();
  }

  function isPlanActive(plan: AppPlan): boolean {
    const sub = activeSubscription.value;
    if (!sub) return false;
    if (sub.planId && sub.planId === plan.id) return true;
    if (sub.planCode && sub.planCode === plan.code) return true;
    return false;
  }

  function getPlanFeatures(plan: AppPlan): AppPlanFeature[] {
    if (!plan.metadataJson) return [];
    try {
      const metadata = JSON.parse(plan.metadataJson);
      if (Array.isArray(metadata.features)) return metadata.features;
    } catch (e) {
      console.error('Failed to parse plan metadata:', e);
    }
    return [];
  }

  function formatPrice(amountCents: number, currency: string): string {
    const amount = amountCents / 100;
    if (currency === 'KZT') return `${amount.toLocaleString('ru-KZ')}₸`;
    return `${currency} ${amount.toLocaleString()}`;
  }

  function formatPlanFeature(feature: AppPlanFeature): string {
    // metadata `label` is unreliable (some seeded plans store a namespaced key
    // with no translation), so resolve by feature.key first.
    const byKey = t('app.planFeature.' + feature.key, { value: feature.value as any });
    if (byKey) return byKey;
    const raw = String(feature.label || '').trim();
    if (raw && !raw.includes('.')) return `${t('app.' + raw) || raw}: ${feature.value}`;
    const human = feature.key.replace(/^max_/, '').replace(/_/g, ' ');
    return `${human ? human.charAt(0).toUpperCase() + human.slice(1) : feature.key}: ${feature.value}`;
  }

  function resolveReturnTo(): string {
    const raw = route.query.returnTo;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && isSafeRelativePath(value)) return value;
    return `/${nsSlug.value}/${config.appKey}`;
  }

  function syncIntervalToActivePlan() {
    if (!activeSubscription.value || plans.value.length === 0) return;
    const activePlan = plans.value.find((p) => p.id === activeSubscription.value!.planId);
    if (activePlan) {
      selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
    }
  }

  async function fetchPlans() {
    loading.value = true;
    error.value = null;
    try {
      const result = await config.loadPlans(nsSlug.value);
      plans.value = result.plans;
    } catch (err) {
      error.value =
        getErrorMessage(err, t) ||
        (t('common.genericError') || 'Something went wrong. Please try again.');
      console.error('Failed to fetch plans:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchActiveSubscription() {
    const appToken = config.token.current();
    const tk = hubToken();
    if (!appToken || !tk) return;
    try {
      activeSubscription.value = await config.loadActiveSubscription({
        nsSlug: nsSlug.value,
        hubToken: tk,
        appToken,
      });
      syncIntervalToActivePlan();
    } catch (err) {
      // OWNER-only query -- a non-owner staff member or a namespace with no
      // subscription yet both land here, and neither is a page-load failure.
      // Either way this isn't a *confirmed* "no subscription", so it must not
      // let autoSelectFreePlanIfNeeded() treat it as one.
      console.error('Failed to fetch active subscription:', err);
      subscriptionFetchFailed.value = true;
    }
  }

  async function redirectIfAlreadySubscribed() {
    if (redirectingAfterReturn.value) return;
    if (!activeSubscription.value) return;
    // Only bounce back when something explicitly sent the user here to pick a
    // plan and resume elsewhere afterwards (?returnTo=...) -- direct
    // navigation (typed URL, "Upgrade Plan" link, a plan-limit modal) wants
    // the grid to render even though almost every namespace has an active
    // plan once the Free tier auto-applies.
    if (!route.query.returnTo) return;

    const returnTo = resolveReturnTo();
    if (returnTo === route.path) return;

    const tk = hubToken();
    if (!tk) return;

    redirectingAfterReturn.value = true;
    try {
      await config.token.ensure(nsSlug.value, tk);
      await navigateTo(returnTo, { replace: true });
    } finally {
      redirectingAfterReturn.value = false;
    }
  }

  // Onboarding should never make someone click a plan picker just to reach a
  // tier that costs nothing -- if a genuinely free plan (not a trial) exists
  // and nothing's subscribed yet, provision it automatically.
  async function autoSelectFreePlanIfNeeded() {
    if (activeSubscription.value) return;
    if (subscriptionFetchFailed.value) return;
    if (route.query.manage) return;
    const freePlan = plans.value.find((p) => p.amountCents === 0);
    if (!freePlan) return;
    await subscribePlan(freePlan);
  }

  async function subscribePlan(plan: AppPlan) {
    const tk = hubToken();
    if (!tk) {
      toast.add({
        title: t('common.error') || 'Error',
        description: t('common.notAuthenticated') || 'Not authenticated',
        color: 'red',
      });
      return;
    }

    // No payment gateway yet -- paid plans without a usable trial go through
    // manual sales contact instead of a real checkout. A plan with an
    // available trial (or any free tier) still subscribes directly; only once
    // the trial for this app is already exhausted do we force contact-us.
    const sub = activeSubscription.value;
    const trialAlreadyUsed =
      !!sub &&
      (sub.status === 'EXPIRED' ||
        sub.status === 'PAST_DUE' ||
        sub.status === 'CANCELED' ||
        (!!sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() < Date.now()));
    if (plan.amountCents > 0 && (plan.trialDays === 0 || trialAlreadyUsed)) {
      useContactUsModal().open({ app: config.appBundle, planName: plan.name });
      return;
    }

    if (!(await usePhoneGate().requirePhone())) return;

    subscribingPlanCode.value = plan.code;
    try {
      // Minting a token only proves namespace membership and provisions the
      // tenant schema as a side effect -- it must NOT be confused with
      // installing the app, which stays gated on a successful subscribe.
      const appToken = await config.token.ensure(nsSlug.value, tk);
      if (!appToken) throw new Error('Failed to get app token');

      const result = await config.subscribe({
        nsSlug: nsSlug.value,
        hubToken: tk,
        appToken,
        planCode: plan.code,
      });
      if (result) activeSubscription.value = result;

      toast.add({
        title: t('common.success') || 'Success',
        description:
          t('app.subscribedToPlan', { plan: plan.name }) || `Subscribed to ${plan.name}`,
        color: 'emerald',
      });

      // Add app to namespace (trigger real installation) -- only now, after a
      // confirmed subscription, is the app considered actually installed.
      const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
      try {
        await hubAddAppToNamespace(tk, nsSlug.value, config.appBundle);
      } catch (installErr) {
        const msg = getErrorMessage(installErr, t).toLowerCase();
        if (!msg.includes('already exists') && !msg.includes('already in the namespace')) {
          throw installErr;
        }
      }

      // Ensure app token is fresh before entering the protected app routes.
      await config.token.ensure(nsSlug.value, tk);

      useAnalytics().track('plan_subscribed', { app: config.appBundle, plan: plan.code });

      await navigateTo(resolveReturnTo(), { replace: true });
    } catch (err) {
      console.error('Failed to subscribe:', err);
      const errorMsg =
        getErrorMessage(err, t) ||
        (t('common.genericError') || 'Something went wrong. Please try again.');
      const regressions = parseDowngradeRegressions(errorMsg);
      if (regressions) {
        useDowngradeBlockedModal().open(regressions);
      } else {
        toast.add({ title: t('common.error') || 'Error', description: errorMsg, color: 'red' });
      }
    } finally {
      subscribingPlanCode.value = null;
    }
  }

  onMounted(async () => {
    const tk = hubToken();
    if (!tk) {
      error.value = t('common.notAuthenticated') || 'Not authenticated';
      return;
    }
    const appToken = await config.token.ensure(nsSlug.value, tk);
    if (!appToken) {
      error.value = t('common.notAuthenticated') || 'Not authenticated';
      return;
    }

    await fetchPlans();
    await fetchActiveSubscription();
    await redirectIfAlreadySubscribed();
    await autoSelectFreePlanIfNeeded();
  });

  watch([plans, activeSubscription], syncIntervalToActivePlan);

  return {
    t,
    nsSlug,
    appBundle: config.appBundle,
    plans,
    loading,
    error,
    selectedInterval,
    subscribingPlanCode,
    activeSubscription,
    displayedPlans,
    goBack,
    isPlanActive,
    getPlanFeatures,
    formatPrice,
    formatPlanFeature,
    subscribePlan,
  };
}
