<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { getErrorMessage } from '@/utils/types/errors';
import { getPlans, type Plan } from '@/api/atrace/plans/plans';
import { subscribeToPlan, type Subscription } from '@/api/atrace/plans/subscribe';
import { getActiveSubscription } from '@/api/atrace/plans/getActiveSubscription';

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

const monthlyPlans = computed(() => plans.value.filter(p => p.interval === 'MONTH'));
const yearlyPlans = computed(() => plans.value.filter(p => p.interval === 'YEAR'));

const displayedPlans = computed(() => 
  selectedInterval.value === 'monthly' ? monthlyPlans.value : yearlyPlans.value
);

// Check if a plan is currently active
function isPlanActive(plan: Plan): boolean {
  if (!activeSubscription.value) return false;
  
  // Match by plan ID (primary method)
  if (activeSubscription.value.planId === plan.id) {
    return true;
  }
  
  // Fallback: Match by plan code if available
  if (activeSubscription.value.planCode && activeSubscription.value.planCode === plan.code) {
    return true;
  }
  
  return false;
}

// Parse features from metadataJson
function getPlanFeatures(plan: Plan): PlanFeature[] {
  if (!plan.metadataJson) return [];
  try {
    const metadata = JSON.parse(plan.metadataJson);
    if (Array.isArray(metadata.features)) {
      return metadata.features;
    }
  } catch (e) {
    console.error('Failed to parse plan metadata:', e);
  }
  return [];
}

// Fetch plans
async function fetchPlans() {
  loading.value = true;
  error.value = null;
  try {
    const result = await getPlans(nsSlug.value, false);
    plans.value = result.plans;
    console.log('Fetched plans:', result.plans.length, result.plans);
  } catch (err) {
    error.value = getErrorMessage(err);
    console.error('Failed to fetch plans:', err);
  } finally {
    loading.value = false;
  }
}

// Fetch active subscription
async function fetchActiveSubscription() {
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) return;

  try {
    activeSubscription.value = await getActiveSubscription(nsSlug.value, 'pieceowater.atrace', token);
    console.log('Active subscription:', activeSubscription.value);
    
    // Auto-switch tab to match active subscription interval
    if (activeSubscription.value && plans.value.length > 0) {
      const activePlan = plans.value.find(p => p.id === activeSubscription.value!.planId);
      if (activePlan) {
        selectedInterval.value = activePlan.interval === 'YEAR' ? 'yearly' : 'monthly';
      }
    }
  } catch (err) {
    console.error('Failed to fetch active subscription:', err);
    // Silently fail - no active subscription is not an error state
  }
}

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === 'KZT') {
    return `${amount.toLocaleString('ru-KZ')}₸`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

function formatInterval(interval: string): string {
  return interval === 'MONTH' ? t('app.perMonth') || 'per month' : t('app.perYear') || 'per year';
}

async function subscribePlan(plan: Plan) {
  const token = useCookie<string | null>('token', { path: '/' }).value;
  if (!token) {
    toast.add({ title: 'Error', description: 'Not authenticated', color: 'red' });
    return;
  }

  subscribingPlanCode.value = plan.code;
  try {
    // Subscribe to plan
    await subscribeToPlan(nsSlug.value, plan.code, 'pieceowater.atrace', token);
    
    toast.add({ 
      title: 'Success', 
      description: `Subscribed to ${plan.name}`,
      color: 'green'
    });

    // Add app to namespace (trigger real installation)
    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    try {
      await hubAddAppToNamespace(token, nsSlug.value, 'pieceowater.atrace');
    } catch (installErr) {
      const msg = getErrorMessage(installErr).toLowerCase();
      if (!msg.includes('already exists') && !msg.includes('already in the namespace')) {
        throw installErr;
      }
    }

    // Navigate to app
    const returnTo = route.query.returnTo as string || `/${nsSlug.value}/atrace`;
    await router.push(returnTo);
  } catch (err) {
    console.error('Failed to subscribe:', err);
    toast.add({
      title: 'Error',
      description: getErrorMessage(err),
      color: 'red'
    });
  } finally {
    subscribingPlanCode.value = null;
  }
}

onMounted(async () => {
  await fetchPlans();
  await fetchActiveSubscription();
});

// Watch for plans changes to re-check active subscription interval
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
    <!-- Header -->
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
            @click="goBack"
            class="min-w-fit gap-2"
          >
            <span class="hidden sm:inline">{{ t('app.back') }}</span>
          </UButton>
          </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Interval Toggle -->
      <div class="flex justify-center mb-8">
        <div class="relative inline-flex rounded-xl border-2 border-gray-200 dark:border-gray-700 p-1.5 bg-gray-50 dark:bg-gray-800/50 shadow-sm">
          <button
            @click="selectedInterval = 'monthly'"
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
          >
            {{ t('app.monthly') || 'Monthly' }}
          </button>
          <button
            @click="selectedInterval = 'yearly'"
            :class="[
              'relative z-10 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-200',
              selectedInterval === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            ]"
          >
            <span>{{ t('app.yearly') || 'Yearly' }}</span>
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-0.5" />
              {{ t('app.bestPrice') || 'Best price' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <!-- Error State -->
      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle"
        color="red"
        variant="soft"
        :title="t('common.error') || 'Error'"
        :description="error"
        class="mb-6"
      />

      <!-- Plans Grid -->
      <div v-else class="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <div
          v-for="plan in displayedPlans"
          :key="plan.id"
          class="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
        >
          <!-- Trial Badge -->
          <div v-if="plan.trialDays > 0" class="absolute top-0 right-0">
            <div class="bg-gradient-to-br from-green-500 to-green-600 text-white px-4 py-2 rounded-bl-2xl shadow-lg">
              <div class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-gift" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ plan.trialDays }} {{ t('app.daysTrial') || 'days trial' }}</span>
              </div>
            </div>
          </div>

          <div class="p-6 pt-12">
            <!-- Plan Name -->
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {{ plan.name }}
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 min-h-[36px]">
              {{ t('app.' + plan.description) || plan.description }}
            </p>

            <!-- Price -->
            <div class="mb-6">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-bold text-gray-900 dark:text-white">
                  {{ formatPrice(plan.amountCents, plan.currency) }}
                </span>
                <span class="text-lg text-gray-500 dark:text-gray-400">
                  / {{ selectedInterval === 'monthly' ? (t('app.month') || 'month') : (t('app.year') || 'year') }}
                </span>
              </div>
            </div>

            <!-- Features -->
            <div class="space-y-3 mb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
              <!-- Trial Days -->
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <span class="font-semibold">{{ plan.trialDays }}</span> {{ t('app.daysFreeTrial') || 'days free trial' }}
                </span>
              </div>

              <!-- Plan-specific features from metadata -->
              <div v-for="feature in getPlanFeatures(plan)" :key="feature.key" class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {{ t('app.' + feature.label) || feature.label }}
                </span>
              </div>

              <!-- Included Seats (legacy) -->
              <div v-if="plan.includedSeats > 0" class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <span class="font-semibold">{{ plan.includedSeats }}</span> {{ t('app.includedSeats') || 'included seats' }}
                </span>
              </div>

              <!-- Included Units (legacy) -->
              <div v-if="plan.includedUnits > 0" class="flex items-start gap-3">
                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                  <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
                </div>
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  <span class="font-semibold">{{ plan.includedUnits }}</span> {{ t('app.includedUnits') || 'included units' }}
                </span>
              </div>
            </div>

            <!-- CTA Button -->
            <UButton
              v-if="!isPlanActive(plan)"
              block
              size="lg"
              :color="plan.code.includes('start') ? 'primary' : 'gray'"
              :variant="plan.code.includes('start') ? 'solid' : 'outline'"
              @click="subscribePlan(plan)"
              :disabled="subscribingPlanCode !== null"
              class="font-semibold dark:hover:bg-primary-900/30 dark:hover:border-primary-500 dark:hover:text-primary-100"
            >
              <template v-if="subscribingPlanCode === plan.code">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                {{ t('app.connecting') || 'Connecting...' }}
              </template>
              <template v-else>
                {{ t('app.selectPlan') || 'Select Plan' }}
              </template>
            </UButton>

            <!-- Active Plan Badge -->
            <div
              v-else
              class="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-center font-bold shadow-lg"
            >
              <div class="flex items-center justify-center gap-2">
                <UIcon name="i-heroicons-check-circle" class="w-6 h-6" />
                <span class="text-lg">{{ t('app.activePlan') || 'Подключено!' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="!loading && !error && displayedPlans.length === 0"
        class="text-center py-12"
      >
        <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p class="text-gray-500 dark:text-gray-400">
          {{ t('app.noPlansAvailable') || 'No plans available' }}
        </p>
      </div>
    </div>
  </div>
</template>
