<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import PlanComparisonTable from '@/components/billing/PlanComparisonTable.vue';
import { usePlansToken } from '@/composables/usePlansToken';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { useDowngradeBlockedModal, parseDowngradeRegressions } from '@/composables/useDowngradeBlockedModal';
import { getErrorMessage } from '@/utils/types/errors';
import { getPlansPlans, subscribeToPlansPlan, getActivePlansSubscription, type Plan, type Subscription } from '@/api/plans/billing';

interface PlanFeature { key: string; value: number | string; label: string; }

const APP_BUNDLE = 'pieceowater.plans';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();

useHead({ title: 'Тарифы — Запись' });

const goBack = () => {
  if (process.client) { window.history.back(); return; }
  router.back();
};

const plans = ref<Plan[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedInterval = ref<'monthly' | 'yearly'>('monthly');
const subscribingPlanCode = ref<string | null>(null);
const activeSubscription = ref<Subscription | null>(null);
const redirectingAfterReturn = ref(false);
const subscriptionFetchFailed = ref(false);

const byPrice = (a: Plan, b: Plan) => a.amountCents - b.amountCents;
const monthlyPlans = computed(() => plans.value.filter(p => p.interval === 'MONTH').sort(byPrice));
const yearlyPlans = computed(() => plans.value.filter(p => p.interval === 'YEAR').sort(byPrice));
const displayedPlans = computed(() => selectedInterval.value === 'monthly' ? monthlyPlans.value : yearlyPlans.value);

function isPlanActive(plan: Plan): boolean {
  if (!activeSubscription.value) return false;
  return activeSubscription.value.planId === plan.id;
}

function getPlanFeatures(plan: Plan): PlanFeature[] {
  if (!plan.metadataJson) return [];
  try {
    const m = JSON.parse(plan.metadataJson);
    if (Array.isArray(m.features)) return m.features;
  } catch (e) { console.error('Failed to parse plan metadata:', e); }
  return [];
}

async function fetchPlans() {
  loading.value = true;
  error.value = null;
  try {
    plans.value = (await getPlansPlans(nsSlug.value, false)).plans;
  } catch (err) {
    error.value = getErrorMessage(err, t) || (t('common.genericError') || 'Что-то пошло не так, попробуйте ещё раз.');
    console.error('Failed to fetch plans:', err);
  } finally {
    loading.value = false;
  }
}

async function fetchActiveSubscription() {
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  try {
    activeSubscription.value = await getActivePlansSubscription(nsSlug.value, hubToken);
    if (activeSubscription.value && plans.value.length > 0) {
      const activePlan = plans.value.find(p => p.id === activeSubscription.value!.planId);
      if (activePlan) selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
    }
  } catch (err) {
    console.error('Failed to fetch active subscription:', err);
    subscriptionFetchFailed.value = true;
  }
}

// A namespace can end up with an active Plans subscription (e.g. via the
// Lota Ultimate bundle) without the app ever being registered in
// namespace_apps — the home tile then still says "Подключить". Self-heal:
// whenever we see an active subscription, make sure the app is installed.
async function ensureAppInstalledIfSubscribed() {
  if (!activeSubscription.value) return;
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) return;
  try {
    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    await hubAddAppToNamespace(hubToken, nsSlug.value, APP_BUNDLE);
  } catch (e) {
    const msg = getErrorMessage(e, t).toLowerCase();
    if (!msg.includes('already exists') && !msg.includes('already in the namespace')) {
      console.error('ensureAppInstalledIfSubscribed:', e);
    }
  }
}

async function redirectIfAlreadySubscribed() {
  if (redirectingAfterReturn.value) return;
  if (!activeSubscription.value) return;
  if (!route.query.returnTo) return;

  const returnTo = resolveReturnTo();
  if (returnTo === route.path) return;

  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) return;

  redirectingAfterReturn.value = true;
  try {
    const { ensure } = usePlansToken();
    await ensure(nsSlug.value, hubToken);
    await navigateTo(returnTo, { replace: true });
  } finally {
    redirectingAfterReturn.value = false;
  }
}

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === 'KZT') return `${amount.toLocaleString('ru-KZ')}₸`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatPlanFeature(feature: PlanFeature): string {
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
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value;
  return `/${nsSlug.value}/plans`;
}

async function autoSelectFreePlanIfNeeded() {
  if (activeSubscription.value) return;
  if (subscriptionFetchFailed.value) return;
  if (route.query.manage) return;
  const freePlan = plans.value.find((p) => p.amountCents === 0);
  if (!freePlan) return;
  await subscribePlan(freePlan);
}

async function subscribePlan(plan: Plan) {
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) {
    toast.add({ title: t('common.error') || 'Ошибка', description: t('common.notAuthenticated') || 'Не авторизован', color: 'red' });
    return;
  }

  const sub = activeSubscription.value;
  const trialAlreadyUsed = !!sub && (
    sub.status === 'EXPIRED' || sub.status === 'PAST_DUE' || sub.status === 'CANCELED' ||
    (!!sub.trialEndDate && new Date(sub.trialEndDate).getTime() < Date.now())
  );
  if (plan.amountCents > 0 && (plan.trialDays === 0 || trialAlreadyUsed)) {
    useContactUsModal().open({ app: APP_BUNDLE, planName: plan.name });
    return;
  }

  if (!(await usePhoneGate().requirePhone())) return;

  subscribingPlanCode.value = plan.code;
  try {
    const { ensure } = usePlansToken();
    const plansToken = await ensure(nsSlug.value, hubToken);
    if (!plansToken) throw new Error('Failed to get plans token');

    activeSubscription.value = await subscribeToPlansPlan(nsSlug.value, plan.code, hubToken);

    toast.add({
      title: t('common.success') || 'Готово',
      description: t('app.subscribedToPlan', { plan: plan.name }) || `Подключён ${plan.name}`,
      color: 'emerald',
    });

    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    try {
      await hubAddAppToNamespace(hubToken, nsSlug.value, APP_BUNDLE);
    } catch (installErr) {
      const msg = getErrorMessage(installErr, t).toLowerCase();
      if (!msg.includes('already exists') && !msg.includes('already in the namespace')) throw installErr;
    }

    await ensure(nsSlug.value, hubToken);
    useAnalytics().track('plan_subscribed', { app: APP_BUNDLE, plan: plan.code });
    await navigateTo(resolveReturnTo(), { replace: true });
  } catch (err) {
    console.error('Failed to subscribe:', err);
    const errorMsg = getErrorMessage(err, t) || (t('common.genericError') || 'Что-то пошло не так, попробуйте ещё раз.');
    const regressions = parseDowngradeRegressions(errorMsg);
    if (regressions) useDowngradeBlockedModal().open(regressions);
    else toast.add({ title: t('common.error') || 'Ошибка', description: errorMsg, color: 'red' });
  } finally {
    subscribingPlanCode.value = null;
  }
}

onMounted(async () => {
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) { error.value = t('common.notAuthenticated') || 'Не авторизован'; return; }

  const { ensure } = usePlansToken();
  const plansToken = await ensure(nsSlug.value, hubToken);
  if (!plansToken) { error.value = t('common.notAuthenticated') || 'Не авторизован'; return; }

  await fetchPlans();
  await fetchActiveSubscription();
  await ensureAppInstalledIfSubscribed();
  await redirectIfAlreadySubscribed();
  await autoSelectFreePlanIfNeeded();
});

watch([plans, activeSubscription], () => {
  if (activeSubscription.value && plans.value.length > 0) {
    const activePlan = plans.value.find(p => p.id === activeSubscription.value!.planId);
    if (activePlan) selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              {{ t('app.subscriptionPlans') || 'Тарифы' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.choosePlanDescription') || 'Выберите тариф, который подходит вашему бизнесу' }}
            </p>
          </div>
          <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" class="min-w-fit gap-2" @click="goBack">
            <span class="hidden sm:inline">{{ t('app.back') || 'Назад' }}</span>
          </UButton>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ContactSupportBanner class="mb-8" />

      <div class="flex justify-center mb-8">
        <div class="relative inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-700 p-1.5 bg-gray-50 dark:bg-gray-800/50 shadow-sm">
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'monthly' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
            ]"
            @click="selectedInterval = 'monthly'"
          >{{ t('app.monthly') || 'Помесячно' }}</button>
          <button
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'yearly' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
            ]"
            @click="selectedInterval = 'yearly'"
          >
            <span>{{ t('app.yearly') || 'На год' }}</span>
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-0.5" />
              {{ t('app.bestPrice') || 'Выгодно' }}
            </span>
          </button>
        </div>
      </div>

      <BillingBundlesForApp application-code="pieceowater.plans" :namespace="nsSlug" :interval="selectedInterval" />

      <div v-if="loading" class="flex justify-center items-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle" color="red" variant="soft"
        :title="t('common.error') || 'Ошибка'" :description="error" class="mb-6"
      />

      <div v-else class="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <div
          v-for="plan in displayedPlans"
          :key="plan.id"
          class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
        >
          <div v-if="plan.trialDays > 0" class="absolute top-0 right-0">
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-bl-2xl shadow-lg">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-gift" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ plan.trialDays }} {{ t('app.daysTrial') || 'дн. пробно' }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-1 flex-col p-6 pt-12">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ plan.name }}</h3>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2 min-h-[2.5rem]">
              {{ t('app.' + plan.description) || plan.description }}
            </p>

            <div class="mb-6">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-bold text-gray-900 dark:text-white">
                  {{ formatPrice(plan.trialDays > 0 ? 0 : plan.amountCents, plan.currency) }}
                </span>
                <s v-if="plan.trialDays > 0 && plan.amountCents > 0" class="text-xl font-semibold text-gray-400 line-through dark:text-gray-500">
                  {{ formatPrice(plan.amountCents, plan.currency) }}
                </s>
                <span class="text-lg text-gray-500 dark:text-gray-400">
                  / {{ selectedInterval === 'monthly' ? (t('app.month') || 'мес') : (t('app.year') || 'год') }}
                </span>
              </div>
              <div v-if="plan.trialDays > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ t('app.afterTrial') || 'После пробного периода' }}:
                <span class="font-semibold">{{ formatPrice(plan.amountCents, plan.currency) }}</span>
                / {{ selectedInterval === 'monthly' ? (t('app.month') || 'мес') : (t('app.year') || 'год') }}
              </div>
            </div>

            <div class="flex-1 space-y-3 mb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <template v-if="plan.trialDays === 0">
                    <span class="font-semibold">{{ t('app.freeForever') || 'Бесплатно навсегда' }}</span>
                  </template>
                  <template v-else>
                    <span class="font-semibold">{{ plan.trialDays }}</span> {{ t('app.daysFreeTrial') || 'дней пробного периода' }}
                  </template>
                </span>
              </div>

              <div v-for="feature in getPlanFeatures(plan)" :key="feature.key" class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ formatPlanFeature(feature) }}</span>
              </div>
            </div>

            <UButton
              v-if="!isPlanActive(plan)"
              block size="lg"
              :color="plan.code.includes('start') ? 'primary' : 'gray'"
              :variant="plan.code.includes('start') ? 'solid' : 'outline'"
              :disabled="subscribingPlanCode !== null"
              class="font-semibold dark:hover:bg-primary-900/30 dark:hover:border-primary-500 dark:hover:text-primary-100"
              @click="subscribePlan(plan)"
            >
              <template v-if="subscribingPlanCode === plan.code">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                {{ t('app.connecting') || 'Подключаем…' }}
              </template>
              <template v-else>{{ t('app.selectPlan') || 'Выбрать тариф' }}</template>
            </UButton>

            <div v-else class="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm">
              <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
              {{ t('app.activePlan') || 'Подключено!' }}
            </div>
          </div>
        </div>
      </div>

      <LegalLinks context="payment" class="mt-8" />

      <PlanComparisonTable
        v-if="!loading && !error"
        :plans="displayedPlans"
        :active-plan-id="activeSubscription?.planId"
        :currency="displayedPlans[0]?.currency"
      />

      <div v-if="!loading && !error && displayedPlans.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p class="text-gray-500 dark:text-gray-400">{{ t('app.noPlansAvailable') || 'Тарифы пока не настроены' }}</p>
      </div>
    </div>
  </div>
</template>
