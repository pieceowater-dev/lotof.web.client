<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansToken } from '@/composables/usePlansToken';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { getErrorMessage } from '@/utils/types/errors';
import { getPlansPlans, subscribeToPlansPlan, getActivePlansSubscription, type Plan, type Subscription } from '@/api/plans/billing';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();

useHead({ title: `${t('app.subscriptionPlans') || 'Тарифы'} — ${t('app.plans')}` });

const plans = ref<Plan[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedInterval = ref<'monthly' | 'yearly'>('monthly');
const subscribingPlanCode = ref<string | null>(null);
const activeSubscription = ref<Subscription | null>(null);

const monthlyPlans = computed(() => plans.value.filter(p => p.interval === 'MONTH'));
const yearlyPlans = computed(() => plans.value.filter(p => p.interval === 'YEAR'));
const displayedPlans = computed(() => selectedInterval.value === 'monthly' ? monthlyPlans.value : yearlyPlans.value);

function isPlanActive(plan: Plan) {
  if (!activeSubscription.value) return false;
  return activeSubscription.value.planId === plan.id || (activeSubscription.value.planCode && activeSubscription.value.planCode === plan.code);
}
function getPlanFeatures(plan: Plan): Array<{ key: string; value: any; label: string }> {
  if (!plan.metadataJson) return [];
  try { const m = JSON.parse(plan.metadataJson); if (Array.isArray(m.features)) return m.features; } catch {}
  return [];
}
function formatPrice(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  return currency === 'KZT' ? `${amount.toLocaleString('ru-KZ')}₸` : `${currency} ${amount.toLocaleString()}`;
}
function goBack() { if (process.client) window.history.back(); else router.back(); }
function resolveReturnTo(): string {
  const raw = route.query.returnTo;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : `/${nsSlug.value}/plans`;
}

async function fetchPlans() {
  loading.value = true; error.value = null;
  try {
    plans.value = (await getPlansPlans(nsSlug.value, false)).plans;
  } catch (err) {
    error.value = getErrorMessage(err, t) || (t('common.genericError') || 'Что-то пошло не так');
  } finally { loading.value = false; }
}
async function fetchActive() {
  activeSubscription.value = await getActivePlansSubscription(nsSlug.value);
  if (activeSubscription.value && plans.value.length) {
    const p = plans.value.find(x => x.id === activeSubscription.value!.planId);
    if (p) selectedInterval.value = p.interval === 'YEAR' ? 'yearly' : 'monthly';
  }
}

async function subscribePlan(plan: Plan) {
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) { toast.add({ title: t('common.error'), description: t('common.notAuthenticated') || 'Не авторизован', color: 'red' }); return; }
  const sub = activeSubscription.value;
  const trialUsed = !!sub && (sub.status === 'EXPIRED' || sub.status === 'PAST_DUE' || sub.status === 'CANCELED' || (!!sub.trialEndDate && new Date(sub.trialEndDate).getTime() < Date.now()));
  if (plan.amountCents > 0 && (plan.trialDays === 0 || trialUsed)) {
    useContactUsModal().open({ app: 'pieceowater.plans', planName: plan.name });
    return;
  }
  subscribingPlanCode.value = plan.code;
  try {
    const { ensure } = usePlansToken();
    await ensure(nsSlug.value, token);
    await subscribeToPlansPlan(nsSlug.value, plan.code, token);
    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    try { await hubAddAppToNamespace(token, nsSlug.value, 'pieceowater.plans'); }
    catch (e) {
      const msg = getErrorMessage(e, t).toLowerCase();
      if (!msg.includes('already exists') && !msg.includes('already in the namespace')) throw e;
    }
    await ensure(nsSlug.value, token);
    toast.add({ title: t('common.success'), description: t('app.subscribedToPlan', { plan: plan.name }) || `Подключён ${plan.name}`, color: 'emerald' });
    useAnalytics().track('plan_subscribed', { app: 'pieceowater.plans', plan: plan.code });
    await navigateTo(resolveReturnTo(), { replace: true });
  } catch (err) {
    toast.add({ title: t('common.error'), description: getErrorMessage(err, t) || (t('common.genericError') || 'Ошибка'), color: 'red' });
  } finally { subscribingPlanCode.value = null; }
}

onMounted(async () => {
  const hubToken = useCookie<string | null>('token', { path: '/' }).value;
  if (!hubToken) { error.value = t('common.notAuthenticated') || 'Не авторизован'; return; }
  await fetchPlans();
  await fetchActive();
  // Auto-provision a genuinely free plan so onboarding never blocks on a picker.
  if (!activeSubscription.value && !route.query.manage) {
    const free = plans.value.find(p => p.amountCents === 0);
    if (free) await subscribePlan(free);
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{{ t('app.subscriptionPlans') || 'Тарифы' }} — {{ t('app.plans') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('app.choosePlanDescription') || 'Выберите подходящий тариф' }}</p>
        </div>
        <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" @click="goBack">
          <span class="hidden sm:inline">{{ t('app.back') || 'Назад' }}</span>
        </UButton>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 py-8">
      <ContactSupportBanner class="mb-8" />
      <BillingBundlesForApp application-code="pieceowater.plans" :namespace="nsSlug" :interval="selectedInterval" />

      <div v-if="monthlyPlans.length && yearlyPlans.length" class="flex justify-center mb-8">
        <div class="inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-700 p-1.5 bg-gray-50 dark:bg-gray-800/50">
          <button :class="['px-6 py-2.5 rounded-lg text-sm font-semibold transition', selectedInterval === 'monthly' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400']" @click="selectedInterval = 'monthly'">{{ t('app.monthly') || 'Помесячно' }}</button>
          <button :class="['px-6 py-2.5 rounded-lg text-sm font-semibold transition', selectedInterval === 'yearly' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400']" @click="selectedInterval = 'yearly'">{{ t('app.yearly') || 'На год' }}</button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12"><UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" /></div>
      <UAlert v-else-if="error" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="t('common.error') || 'Ошибка'" :description="error" class="mb-6" />

      <div v-else class="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div v-for="plan in displayedPlans" :key="plan.id" class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:shadow-xl transition overflow-hidden">
          <div v-if="plan.trialDays > 0" class="absolute top-0 right-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-3 py-1.5 rounded-bl-2xl text-xs font-bold">{{ plan.trialDays }} {{ t('app.daysTrial') || 'дн. пробно' }}</div>
          <div class="p-6 pt-10">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ plan.name }}</h3>
            <div class="mb-5 flex items-baseline gap-2">
              <span class="text-4xl font-bold text-gray-900 dark:text-white">{{ formatPrice(plan.trialDays > 0 ? 0 : plan.amountCents, plan.currency) }}</span>
              <span class="text-lg text-gray-500">/ {{ selectedInterval === 'monthly' ? (t('app.month') || 'мес') : (t('app.year') || 'год') }}</span>
            </div>
            <div class="space-y-2.5 mb-6 border-t border-gray-100 dark:border-gray-700 pt-4">
              <div class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <UIcon name="i-heroicons-check" class="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                <span v-if="plan.trialDays === 0" class="font-semibold">{{ t('app.freeForever') || 'Бесплатно навсегда' }}</span>
                <span v-else><span class="font-semibold">{{ plan.trialDays }}</span> {{ t('app.daysFreeTrial') || 'дней пробного периода' }}</span>
              </div>
              <div v-for="f in getPlanFeatures(plan)" :key="f.key" class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <UIcon name="i-heroicons-check" class="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                <span>{{ (t('app.' + f.label) || f.label || f.key) }}: {{ f.value }}</span>
              </div>
            </div>
            <UButton v-if="!isPlanActive(plan)" block size="lg" :color="plan.code.includes('start') ? 'primary' : 'gray'" :variant="plan.code.includes('start') ? 'solid' : 'outline'" :disabled="subscribingPlanCode !== null" @click="subscribePlan(plan)">
              <template v-if="subscribingPlanCode === plan.code"><UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />{{ t('app.connecting') || 'Подключаем…' }}</template>
              <template v-else>{{ t('app.selectPlan') || 'Выбрать тариф' }}</template>
            </UButton>
            <div v-else class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center font-bold flex items-center justify-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />{{ t('app.activePlan') || 'Подключено!' }}
            </div>
          </div>
        </div>
      </div>

      <LegalLinks context="payment" class="mt-8" />

      <div v-if="!loading && !error && !displayedPlans.length" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto mb-3 opacity-60" />
        {{ t('app.noPlansAvailable') || 'Тарифы пока не настроены' }}
      </div>
    </div>
  </div>
</template>
