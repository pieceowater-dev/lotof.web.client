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

// Shows the bundles that include this application, above the app's own
// point plans. A bundle is one priced offer covering several apps; subscribing
// to it activates a per-app subscription for every app it contains.
const props = defineProps<{
  applicationCode: string; // e.g. "pieceowater.atrace"
  namespace: string;
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

const visibleBundles = computed(() => bundles.value.filter((b) => b.status !== 'ARCHIVED'));

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

  // No payment gateway: a paid bundle with no trial goes through sales contact.
  if (b.amountCents > 0 && b.trialDays === 0) {
    useContactUsModal().open({ app: 'bundle', planName: b.name });
    return;
  }

  if (!(await usePhoneGate().requirePhone())) return;

  activatingCode.value = b.code;
  try {
    const res = await capitalActivateBundle(token, props.namespace, b.code, 'cash');
    if (!res.success) {
      toast.add({
        title: t('app.bundleActivateFailed') || 'Не удалось подключить бандл',
        description: res.error || res.message,
        color: 'red',
      });
      return;
    }
    try {
      useAnalytics().track('bundle_subscribed', { bundle: b.code });
    } catch {}
    toast.add({
      title: t('app.bundleConnected') || 'Бандл подключён',
      description: b.name,
      color: 'green',
    });
    await load();
    emit('activated');
  } catch (e: any) {
    toast.add({
      title: t('app.bundleActivateFailed') || 'Не удалось подключить бандл',
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
    <div class="mb-4 flex items-center gap-2">
      <UIcon name="lucide:layers" class="h-5 w-5 text-primary-600 dark:text-primary-300" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('app.bundlesForThisApp') || 'Бандлы с этим приложением' }}
      </h2>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="b in visibleBundles"
        :key="b.id"
        class="relative rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-900/10 p-5"
      >
        <div
          v-if="b.trialDays > 0"
          class="absolute right-0 top-0 rounded-bl-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          {{ b.trialDays }} {{ t('app.daysTrial') || 'дн. триал' }}
        </div>

        <p class="text-[11px] font-bold uppercase tracking-wide text-primary-600 dark:text-primary-300">
          {{ t('app.bundle') || 'Бандл' }}
        </p>
        <h3 class="mt-1 text-lg font-bold text-gray-900 dark:text-white">{{ b.name }}</h3>
        <p v-if="b.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ b.description }}</p>

        <div class="mt-3 flex items-baseline gap-1.5">
          <span class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ b.trialDays > 0 ? '0' : formatPrice(b.amountCents, b.currency) }}
          </span>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            / {{ b.interval === 'YEAR' ? (t('app.year') || 'год') : (t('app.month') || 'мес') }}
          </span>
        </div>

        <div class="mt-3 border-t border-primary-100 dark:border-primary-800/60 pt-3">
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('app.bundleContains') || 'Входит' }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="it in b.items"
              :key="it.applicationCode + it.planCode"
              class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <UIcon name="lucide:check" class="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              <span class="font-medium">{{ appLabel(it.applicationCode) }}</span>
              <span v-if="it.planName" class="text-gray-500 dark:text-gray-400">· {{ it.planName }}</span>
            </li>
          </ul>
        </div>

        <div
          v-if="isActive(b)"
          class="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-center font-bold text-white"
        >
          <UIcon name="i-heroicons-check-circle" class="mr-1 inline h-5 w-5" />
          {{ t('app.activePlan') || 'Подключено!' }}
        </div>
        <UButton
          v-else
          block
          size="lg"
          color="primary"
          class="mt-4 font-semibold"
          :loading="activatingCode === b.code"
          :disabled="activatingCode !== null"
          @click="subscribe(b)"
        >
          {{ t('app.connectBundle') || 'Подключить бандл' }}
        </UButton>
      </div>
    </div>
  </section>
</template>
