<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
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

// /ns/bundles -- a flat catalogue of every bundle, scoped to the currently
// selected namespace (same selection the /hub dashboard uses). Reached from the
// "current namespace" accordion on /hub. A bundle is one priced offer covering
// several apps; connecting it activates a per-app subscription for each.
const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const { user, isLoggedIn, initialized, fetchUser, login } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, titleBySlug, load: loadNamespaces } = useNamespace();

useSeoMeta({ title: () => t('app.bundles') || 'Бандлы', robotsNoindex: true });
useHead({ titleTemplate: (s) => s ?? 'lota' });

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

const visibleBundles = computed(() => bundles.value.filter((b) => b.status !== 'ARCHIVED'));

function isActive(b: Bundle): boolean {
  return activeCodes.value.includes(b.code);
}

async function loadBundles() {
  const token = hubToken();
  if (!token) return;
  loading.value = true;
  try {
    bundles.value = await capitalListBundles(token);
  } catch (e) {
    logError('[bundles] failed to list bundles', e);
    bundles.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadActive() {
  const token = hubToken();
  if (!token || !selectedNS.value) {
    activeCodes.value = [];
    return;
  }
  try {
    activeCodes.value = await capitalGetActiveBundles(token, selectedNS.value);
  } catch {
    activeCodes.value = [];
  }
}

async function subscribe(b: Bundle) {
  const token = hubToken();
  if (!token || !selectedNS.value) return;

  if (b.amountCents > 0 && b.trialDays === 0) {
    useContactUsModal().open({ app: 'bundle', planName: b.name });
    return;
  }
  if (!(await usePhoneGate().requirePhone())) return;

  activatingCode.value = b.code;
  try {
    const res = await capitalActivateBundle(token, selectedNS.value, b.code, 'cash');
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
    toast.add({ title: t('app.bundleConnected') || 'Бандл подключён', description: b.name, color: 'green' });
    await loadActive();
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

watch(selectedNS, () => loadActive());

onMounted(async () => {
  await nextTick();
  await fetchUser();
  if (!isLoggedIn.value) {
    login('/ns/bundles');
    return;
  }
  await loadNamespaces().catch(() => {});
  await loadBundles();
  await loadActive();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            {{ t('app.bundles') || 'Бандлы' }}
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('app.bundlesPageSubtitle') || 'Наборы тарифов сразу на несколько приложений' }}
          </p>
        </div>
        <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" @click="router.push('/hub')">
          <span class="hidden sm:inline">{{ t('app.back') || 'Назад' }}</span>
        </UButton>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Namespace selector -->
      <div v-if="allNamespaces.length > 1" class="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('app.currentNamespace') || 'Пространство' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="slug in allNamespaces"
            :key="slug"
            class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
            :class="selectedNS === slug
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'"
            @click="setNamespace(slug)"
          >
            {{ titleBySlug(slug) || slug }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <UIcon name="svg-spinners:ring-resize" class="h-10 w-10 text-primary-600" />
      </div>

      <div
        v-else-if="!visibleBundles.length"
        class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('app.noBundlesYet') || 'Бандлов пока нет' }}
      </div>

      <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="b in visibleBundles"
          :key="b.id"
          class="relative flex flex-col rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-800 p-5"
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

          <div class="mt-3 flex-1 border-t border-gray-100 dark:border-gray-700 pt-3">
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
            {{ t('app.bundleConnectedForNs', { ns: titleBySlug(selectedNS) || selectedNS }) || 'Подключено' }}
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
    </div>
  </div>
</template>
