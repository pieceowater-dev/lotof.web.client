<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { ALL_APPS } from '@/config/apps';
import { logError } from '@/utils/logger';
import {
  capitalListBundles,
  capitalGetActiveBundles,
  capitalActivateBundle,
  type Bundle,
} from '@/api/capital/bundles';

// Bundles that include this application, shown above the app's own point plans
// on the /plans screen -- same card style, and it follows the page's own
// monthly/yearly toggle via the `interval` prop.
const props = defineProps<{
  applicationCode: string; // e.g. "pieceowater.atrace"
  namespace: string;
  interval?: 'monthly' | 'yearly';
}>();

const emit = defineEmits<{ (e: 'activated'): void }>();

const { t } = useI18n();
const toast = useToast();

const bundles = ref<Bundle[]>([]);
const activeCodes = ref<string[]>([]);
const loading = ref(true);
const activatingCode = ref<string | null>(null);

function hubToken(): string | null {
  return useCookie<string | null>('token', { path: '/' }).value;
}

function appLabel(code: string): string {
  const app = ALL_APPS.find((a) => a.bundle === code);
  return app ? t(app.titleKey) : code;
}

function formatPrice(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === 'KZT') return `${amount.toLocaleString('ru-KZ')}₸`;
  return `${currency} ${amount.toLocaleString()}`;
}

function isActive(b: Bundle): boolean {
  return activeCodes.value.includes(b.code);
}

const wantInterval = computed(() => (props.interval === 'yearly' ? 'YEAR' : 'MONTH'));
const visibleBundles = computed(() =>
  bundles.value.filter((b) => b.status !== 'ARCHIVED' && b.interval === wantInterval.value)
);

async function load() {
  loading.value = true;
  try {
    const token = hubToken();
    if (!token) return;
    const [list, active] = await Promise.all([
      capitalListBundles(token, props.applicationCode),
      capitalGetActiveBundles(token, props.namespace).catch(() => [] as string[]),
    ]);
    bundles.value = list;
    activeCodes.value = active;
  } catch (e) {
    // A bundle catalog outage must never break the app's own plans page.
    logError('[bundles] failed to load bundles for app', e);
    bundles.value = [];
  } finally {
    loading.value = false;
  }
}

async function subscribe(b: Bundle) {
  const token = hubToken();
  if (!token) return;

  // No acquiring yet -- every paid bundle goes through the sales-contact modal.
  if (b.amountCents > 0) {
    useContactUsModal().open({ app: 'bundle', planName: b.name });
    return;
  }

  if (!(await usePhoneGate().requirePhone())) return;

  activatingCode.value = b.code;
  try {
    const res = await capitalActivateBundle(token, props.namespace, b.code, 'cash');
    if (!res.success) {
      toast.add({
        title: t('app.bundleActivateFailed') || 'Не удалось подключить сборку',
        description: res.error || res.message,
        color: 'red',
      });
      return;
    }
    try {
      useAnalytics().track('bundle_subscribed', { bundle: b.code });
    } catch {}
    toast.add({
      title: t('app.bundleConnected') || 'Сборка подключена',
      description: b.name,
      color: 'green',
    });
    await load();
    emit('activated');
  } catch (e: any) {
    toast.add({
      title: t('app.bundleActivateFailed') || 'Не удалось подключить сборку',
      description: e?.message,
      color: 'red',
    });
  } finally {
    activatingCode.value = null;
  }
}

onMounted(load);
</script>

<template>
  <section v-if="!loading && visibleBundles.length" class="mb-10">
    <div class="mb-5 flex items-center gap-2">
      <UIcon name="lucide:layers" class="h-5 w-5 text-primary-600 dark:text-primary-300" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('app.bundlesForThisApp') || 'Готовые сборки с этим приложением' }}
      </h2>
    </div>

    <div class="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      <div
        v-for="b in visibleBundles"
        :key="b.id"
        class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-primary-200 dark:border-primary-800 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
      >
        <div v-if="b.trialDays > 0" class="absolute top-0 right-0">
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-bl-2xl shadow-lg">
            <div class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-gift" class="w-4 h-4" />
              <span class="text-xs font-bold">{{ b.trialDays }} {{ t('app.daysTrial') || 'дней бесплатно!' }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-1 flex-col p-6 pt-12">
          <p class="text-[11px] font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-1">
            {{ t('app.bundle') || 'Готовая сборка' }}
          </p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">{{ b.name }}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 min-h-[36px]">{{ b.description }}</p>

          <div class="mb-6">
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-bold text-gray-900 dark:text-white">
                {{ formatPrice(b.trialDays > 0 ? 0 : b.amountCents, b.currency) }}
              </span>
              <s
                v-if="b.trialDays > 0 && b.amountCents > 0"
                class="text-xl font-semibold text-gray-400 line-through dark:text-gray-500"
              >{{ formatPrice(b.amountCents, b.currency) }}</s>
              <span class="text-lg text-gray-500 dark:text-gray-400">
                / {{ b.interval === 'YEAR' ? (t('app.year') || 'год') : (t('app.month') || 'мес') }}
              </span>
            </div>
            <div v-if="b.trialDays > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {{ t('app.afterTrial') || 'После пробного периода' }}:
              <span class="font-semibold">{{ formatPrice(b.amountCents, b.currency) }}</span>
              / {{ b.interval === 'YEAR' ? (t('app.year') || 'год') : (t('app.month') || 'мес') }}
            </div>
          </div>

          <div class="flex-1 space-y-3 mb-6 border-t border-gray-100 dark:border-gray-700 pt-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('app.bundleContains') || 'Входит' }}
            </p>
            <div
              v-for="it in b.items"
              :key="it.applicationCode + it.planCode"
              class="flex items-start gap-3"
            >
              <div class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mt-0.5">
                <UIcon name="i-heroicons-check" class="w-3 h-3 text-primary-600 dark:text-primary-400" />
              </div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                <span class="font-semibold">{{ appLabel(it.applicationCode) }}</span>
                <span v-if="it.planName" class="text-gray-500 dark:text-gray-400"> · {{ it.planName }}</span>
              </span>
            </div>
          </div>

          <UButton
            v-if="!isActive(b)"
            block
            size="lg"
            color="primary"
            :disabled="activatingCode !== null"
            class="font-semibold"
            @click="subscribe(b)"
          >
            <template v-if="activatingCode === b.code">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-2 animate-spin" />
              {{ t('app.connecting') || 'Подключаем...' }}
            </template>
            <template v-else>
              {{ t('app.connectBundle') || 'Подключить сборку' }}
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
  </section>
</template>
