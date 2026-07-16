<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { getErrorMessage } from '@/utils/types/errors';
import { getMenuPlans, type Plan } from '@/api/menu/plans/plans';
import { subscribeToMenuPlan, type Subscription } from '@/api/menu/plans/subscribe';
import { getActiveMenuSubscription } from '@/api/menu/plans/getActiveSubscription';

interface PlanFeature {
  key: string;
  value: number | string;
  label: string;
}

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();

const goBack = () => {
  if (process.client) {
    window.history.back();
    return;
  }
  router.back();
};

const plans = ref<Plan[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedInterval = ref<'monthly' | 'yearly'>('monthly');
const subscribingPlanCode = ref<string | null>(null);
const activeSubscription = ref<Subscription | null>(null);
const redirectingAfterReturn = ref(false);

const monthlyPlans = computed(() => plans.value.filter(p => p.interval === 'MONTH'));
const yearlyPlans = computed(() => plans.value.filter(p => p.interval === 'YEAR'));

const displayedPlans = computed(() =>
  selectedInterval.value === 'monthly' ? monthlyPlans.value : yearlyPlans.value
);

function isPlanActive(plan: Plan): boolean {
  if (!activeSubscription.value) return false;
  if (activeSubscription.value.planId === plan.id) return true;
  if (activeSubscription.value.planCode && activeSubscription.value.planCode === plan.code) return true;
  return false;
}

function getPlanFeatures(plan: Plan): PlanFeature[] {
  if (!plan.metadataJson) return [];
  try {
    const metadata = JSON.parse(plan.metadataJson);
    if (Array.isArray(metadata.features)) return metadata.features;
  } catch (e) {
    console.error('Failed to parse plan metadata:', e);
  }
  return [];
}

async function fetchPlans() {
  loading.value = true;
  error.value = null;
  try {
    const result = await getMenuPlans(nsSlug.value, false);
    plans.value = result.plans;
  } catch (err) {
    error.value = getErrorMessage(err) || (t('common.genericError') || 'Something went wrong. Please try again.');
    console.error('Failed to fetch plans:', err);
  } finally {
    loading.value = false;
  }
}

async function fetchActiveSubscription() {
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) return;

  try {
    activeSubscription.value = await getActiveMenuSubscription(nsSlug.value, 'pieceowater.menu', token);
    if (activeSubscription.value && plans.value.length > 0) {
      const activePlan = plans.value.find(p => p.id === activeSubscription.value!.planId);
      if (activePlan) {
        selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
      }
    }
  } catch (err) {
    console.error('Failed to fetch active subscription:', err);
  }
}

async function redirectIfAlreadySubscribed() {
  if (redirectingAfterReturn.value) return;
  if (!activeSubscription.value) return;
  // Explicit "manage/change plan" entry point (e.g. from Settings) — let the
  // user view and change their plan instead of bouncing them straight back.
  if (route.query.manage) return;

  const returnTo = resolveReturnTo();
  if (returnTo === route.path) return;

  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) return;

  redirectingAfterReturn.value = true;
  try {
    const { ensure } = useMenuToken();
    await ensure(nsSlug.value, token);
    await navigateTo(returnTo, { replace: true });
  } finally {
    redirectingAfterReturn.value = false;
  }
}

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === 'KZT') {
    return `${amount.toLocaleString('ru-KZ')}₸`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

function formatPlanFeature(feature: PlanFeature): string {
  const localizedLabel = t('app.' + feature.label) || feature.label || feature.key;
  return `${localizedLabel}: ${feature.value}`;
}

function resolveReturnTo(): string {
  const raw = route.query.returnTo;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return `/${nsSlug.value}/menu`;
}

async function subscribePlan(plan: Plan) {
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) {
    toast.add({
      title: t('common.error') || 'Error',
      description: t('common.notAuthenticated') || 'Not authenticated',
      color: 'red'
    });
    return;
  }

  subscribingPlanCode.value = plan.code;
  try {
    await subscribeToMenuPlan(nsSlug.value, plan.code, 'pieceowater.menu', token);

    toast.add({
      title: t('common.success') || 'Success',
      description: t('app.subscribedToPlan', { plan: plan.name }) || `Subscribed to ${plan.name}`,
      color: 'emerald'
    });

    // Add app to namespace (trigger real installation)
    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    try {
      await hubAddAppToNamespace(token, nsSlug.value, 'pieceowater.menu');
    } catch (installErr) {
      const msg = getErrorMessage(installErr).toLowerCase();
      if (!msg.includes('already exists') && !msg.includes('already in the namespace')) {
        throw installErr;
      }
    }

    // Ensure app token is ready before entering protected menu routes.
    const { ensure } = useMenuToken();
    await ensure(nsSlug.value, token);

    // Navigate to app
    const returnTo = resolveReturnTo();
    await navigateTo(returnTo, { replace: true });
  } catch (err) {
    console.error('Failed to subscribe:', err);
    const errorMsg = getErrorMessage(err) || (t('common.genericError') || 'Something went wrong. Please try again.');

    let title = t('common.error') || 'Error';
    let description = errorMsg;

    if (errorMsg.includes('downgrade not allowed')) {
      title = t('app.cannotDowngradePlan') || 'Cannot Downgrade Plan';
      const match = errorMsg.match(/downgrade not allowed:(.+?)(?:\.|$)/);
      if (match) description = match[1].trim();
    }

    toast.add({ title, description, color: 'red' });
  } finally {
    subscribingPlanCode.value = null;
  }
}

onMounted(async () => {
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) {
    error.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  const { ensure } = useMenuToken();
  const menuToken = await ensure(nsSlug.value, hubToken);
  if (!menuToken) {
    error.value = t('common.notAuthenticated') || 'Not authenticated';
    return;
  }

  await fetchPlans();
  await fetchActiveSubscription();
  await redirectIfAlreadySubscribed();
});

watch([plans, activeSubscription], () => {
  if (activeSubscription.value && plans.value.length > 0) {
    const activePlan = plans.value.find(p => p.id === activeSubscription.value!.planId);
    if (activePlan) {
      selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ t('app.subscriptionPlans') || 'Subscription Plans' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.choosePlanDescription') || 'Choose a plan that works best for your team' }}
            </p>
          </div>
          <UButton
            icon="lucide:arrow-left"
            size="xs"
            color="primary"
            variant="soft"
            class="min-w-fit gap-2"
            @click="goBack"
          >
            <span class="hidden sm:inline">{{ t('app.back') }}</span>
          </UButton>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex justify-center mb-8">
        <div class="relative inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-700 p-1.5 bg-gray-50 dark:bg-gray-800/50 shadow-sm">
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="selectedInterval = 'monthly'"
          >
            {{ t('app.monthly') || 'Monthly' }}
          </button>
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
            @click="selectedInterval = 'yearly'"
          >
            <span>{{ t('app.yearly') || 'Yearly' }}</span>
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-0.5" />
              {{ t('app.bestPrice') || 'Best price' }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center items-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        :title="t('common.error') || 'Error'"
        :description="error"
        class="mb-6"
      />

      <div v-else class="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <div
          v-for="plan in displayedPlans"
          :key="plan.id"
          class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
        >
          <div v-if="plan.trialDays > 0" class="absolute top-0 right-0">
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-bl-2xl shadow-lg">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-gift" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ plan.trialDays }} {{ t('app.daysTrial') || 'days trial' }}</span>
              </div>
            </div>
          </div>

          <div class="p-6 pt-12">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {{ plan.name }}
            </h3>

            <div class="mb-6">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-bold text-gray-900 dark:text-white">
                  {{ plan.trialDays > 0 ? '0' : formatPrice(plan.amountCents, plan.currency) }}
                </span>
                <span class="text-lg text-gray-500 dark:text-gray-400">
                  / {{ selectedInterval === 'monthly' ? (t('app.month') || 'month') : (t('app.year') || 'year') }}
                </span>
              </div>
              <div v-if="plan.trialDays > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ t('app.afterTrial') || 'После триала' }}:
                <span class="font-semibold">{{ formatPrice(plan.amountCents, plan.currency) }}</span>
                / {{ selectedInterval === 'monthly' ? (t('app.month') || 'month') : (t('app.year') || 'year') }}
              </div>
            </div>

            <div class="space-y-3 mb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <template v-if="plan.trialDays === 0">
                    <span class="font-semibold">{{ t('app.freeForever') || 'Free forever' }}</span>
                  </template>
                  <template v-else>
                    <span class="font-semibold">{{ plan.trialDays }}</span> {{ t('app.daysFreeTrial') || 'days free trial' }}
                  </template>
                </span>
              </div>

              <div
                v-for="feature in getPlanFeatures(plan)"
                :key="feature.key"
                class="flex items-start gap-3"
              >
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {{ formatPlanFeature(feature) }}
                </span>
              </div>
            </div>

            <UButton
              v-if="!isPlanActive(plan)"
              block
              size="lg"
              :color="plan.code.includes('start') ? 'primary' : 'gray'"
              :variant="plan.code.includes('start') ? 'solid' : 'outline'"
              :disabled="subscribingPlanCode !== null"
              class="font-semibold dark:hover:bg-primary-900/30 dark:hover:border-primary-500 dark:hover:text-primary-100"
              @click="subscribePlan(plan)"
            >
              <template v-if="subscribingPlanCode === plan.code">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                {{ t('app.connecting') || 'Connecting...' }}
              </template>
              <template v-else>
                {{ t('app.selectPlan') || 'Select Plan' }}
              </template>
            </UButton>

            <div
              v-else
              class="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center font-bold shadow-lg"
            >
              <div class="flex items-center justify-center gap-2">
                <UIcon name="i-heroicons-check-circle" class="w-6 h-6" />
                <span class="text-lg">{{ t('app.activePlan') || 'Подключено!' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!loading && !error && displayedPlans.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p class="text-gray-500 dark:text-gray-400">
          {{ t('app.noPlansAvailable') || 'No plans available' }}
        </p>
      </div>
    </div>
  </div>
</template>
