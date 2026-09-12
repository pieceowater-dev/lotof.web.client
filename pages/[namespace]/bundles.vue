<script setup lang="ts">
definePageMeta({ layout: 'quiet' });

import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { ALL_APPS } from '@/config/apps';
import { logError } from '@/utils/logger';
import {
  capitalListBundles,
  capitalGetActiveBundles,
  capitalActivateBundle,
  capitalListPlans,
  type Bundle,
  type CapitalPlan,
} from '@/api/capital/bundles';
import BundleComparisonTable from '@/components/billing/BundleComparisonTable.vue';
import ContactSupportBanner from '@/components/ui/ContactSupportBanner.vue';
import LegalLinks from '@/components/ui/LegalLinks.vue';

// /{namespace}/bundles -- ready-made bundles (each covers several apps), scoped
// to the namespace in the URL. Laid out like the per-app /plans screens: a
// monthly/yearly toggle up top, one card per bundle for the chosen interval.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { isLoggedIn, fetchUser, login } = useAuth();
const { all: allNamespaces, selected: globalNs, setNamespace, titleBySlug, load: loadNamespaces } = useNamespace();

const ns = computed(() => String(route.params.namespace || ''));

// Only switch the global selection to a namespace the user actually belongs to
// -- otherwise a stray URL segment (e.g. the literal "/ns/bundles") would get
// added to the namespace list and make the switcher appear for single-space users.
function syncGlobalNs() {
  if (ns.value && allNamespaces.value.includes(ns.value)) setNamespace(ns.value);
}

// Show the space switcher only when there's a real choice.
const showNsSwitcher = computed(() => allNamespaces.value.filter(Boolean).length > 1);

useSeoMeta({ title: () => t('app.bundles') || 'Готовые сборки', robots: 'noindex, nofollow' });
useHead({ titleTemplate: (s) => s ?? 'lota' });

const bundles = ref<Bundle[]>([]);
const activeCodes = ref<string[]>([]);
const loading = ref(true);
const activatingCode = ref<string | null>(null);
const selectedInterval = ref<'monthly' | 'yearly'>('monthly');
// planCode -> per-app plan (for the comparison table's limit rows)
const planLookup = ref<Record<string, CapitalPlan>>({});

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
const monthlyBundles = computed(() => visibleBundles.value.filter((b) => b.interval === 'MONTH'));
const yearlyBundles = computed(() => visibleBundles.value.filter((b) => b.interval === 'YEAR'));
const displayedBundles = computed(() =>
  selectedInterval.value === 'monthly' ? monthlyBundles.value : yearlyBundles.value
);

function isActive(b: Bundle): boolean {
  return activeCodes.value.includes(b.code);
}

function switchNs(slug: string) {
  if (slug === ns.value) return;
  setNamespace(slug);
  router.push(`/${slug}/bundles`);
}

async function loadBundles() {
  const token = hubToken();
  if (!token) return;
  loading.value = true;
  try {
    bundles.value = await capitalListBundles(token);
    void loadMemberPlans(token);
  } catch (e) {
    logError('[bundles] failed to list bundles', e);
    bundles.value = [];
  } finally {
    loading.value = false;
  }
}

// Pull the plans of every app referenced by a bundle so the comparison table
// can show real limits. Best-effort -- the table just omits limit rows if this
// fails.
async function loadMemberPlans(token: string) {
  const appCodes = Array.from(
    new Set(bundles.value.flatMap((b) => b.items.map((it) => it.applicationCode)))
  );
  const lists = await Promise.all(
    appCodes.map((c) => capitalListPlans(token, c).catch(() => [] as CapitalPlan[]))
  );
  const map: Record<string, CapitalPlan> = {};
  for (const list of lists) for (const p of list) map[p.code] = p;
  planLookup.value = map;
}

async function loadActive() {
  const token = hubToken();
  if (!token || !ns.value) {
    activeCodes.value = [];
    return;
  }
  try {
    activeCodes.value = await capitalGetActiveBundles(token, ns.value);
  } catch {
    activeCodes.value = [];
  }
}

// If a yearly bundle is already active, open on the yearly tab.
watch([bundles, activeCodes], () => {
  const active = visibleBundles.value.find((b) => activeCodes.value.includes(b.code));
  if (active) selectedInterval.value = active.interval === 'YEAR' ? 'yearly' : 'monthly';
});

async function subscribe(b: Bundle) {
  const token = hubToken();
  if (!token || !ns.value) return;

  // No acquiring yet -- every paid bundle routes to the sales-contact modal
  // (same "talk to a human" flow as a paid plan without a usable trial).
  if (b.amountCents > 0) {
    useContactUsModal().open({ app: 'bundle', planName: b.name });
    return;
  }
  if (!(await usePhoneGate().requirePhone())) return;

  activatingCode.value = b.code;
  try {
    const res = await capitalActivateBundle(token, ns.value, b.code, 'cash');
    if (!res.success) {
      toast.add({
        title: t('app.bundleActivateFailed') || 'Не удалось подключить сборку',
        description: res.error || res.message,
        color: 'red',
      });
      return;
    }
    // Capital now has a subscription per app in the bundle, but the apps
    // still have to be registered in the namespace (hub's namespace_apps) or
    // the home tiles keep showing "Подключить". Mirror what the per-app
    // tariff page does after a single subscribe.
    try {
      const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
      await Promise.all(
        [...new Set(b.items.map((it) => it.applicationCode))].filter(Boolean).map(async (appBundle) => {
          try { await hubAddAppToNamespace(token, ns.value, appBundle); }
          catch (installErr: any) {
            const msg = String(installErr?.message || '').toLowerCase();
            if (!msg.includes('already exists') && !msg.includes('already in the namespace')) throw installErr;
          }
        }),
      );
    } catch (e) {
      logError('[bundles] app install after bundle activate failed', e);
    }

    try {
      useAnalytics().track('bundle_subscribed', { bundle: b.code });
    } catch {}
    toast.add({ title: t('app.bundleConnected') || 'Сборка подключена', description: b.name, color: 'green' });
    await loadActive();
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

watch(ns, () => {
  syncGlobalNs();
  loadActive();
});

onMounted(async () => {
  await nextTick();
  await fetchUser();
  if (!isLoggedIn.value) {
    login(route.fullPath);
    return;
  }
  await loadNamespaces().catch(() => {});
  // Stray/typed URL segment that isn't one of the user's spaces -> bounce to
  // their current one so the page always operates on a real namespace.
  if (ns.value && allNamespaces.value.length && !allNamespaces.value.includes(ns.value) && globalNs.value) {
    router.replace(`/${globalNs.value}/bundles`);
    return;
  }
  syncGlobalNs();
  await loadBundles();
  await loadActive();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              {{ t('app.bundles') || 'Готовые сборки' }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.bundlesPageSubtitle') || 'Готовые наборы приложений в одном тарифе' }}
            </p>
          </div>
          <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" class="min-w-fit gap-2" @click="router.push('/hub')">
            <span class="hidden sm:inline">{{ t('app.back') || 'Назад' }}</span>
          </UButton>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ContactSupportBanner class="mb-8" />

      <div v-if="visibleBundles.length" class="flex justify-center mb-8">
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
            {{ t('app.monthly') || 'Помесячно' }}
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
            <span>{{ t('app.yearly') || 'Годовая' }}</span>
            <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-0.5" />
              {{ t('app.bestPrice') || 'Выгодно' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Namespace selector: a horizontal strip of cards (scrolls on mobile) -->
      <div v-if="showNsSwitcher" class="mb-8">
        <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('app.currentNamespace') || 'Выбранное пространство' }}
        </p>
        <div class="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            v-for="slug in allNamespaces"
            :key="slug"
            type="button"
            class="snap-start flex-shrink-0 w-40 sm:w-44 rounded-2xl border p-3 text-left transition-all"
            :class="ns === slug
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'"
            @click="switchNs(slug)"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ titleBySlug(slug) || slug }}
                </span>
                <span class="mt-0.5 block truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  {{ slug }}
                </span>
              </span>
              <UIcon
                v-if="ns === slug"
                name="lucide:check-circle-2"
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400"
              />
            </div>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500" />
      </div>

      <template v-else>

        <!-- Empty -->
        <div
          v-if="!displayedBundles.length"
          class="text-center py-12"
        >
          <UIcon name="i-heroicons-inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p class="text-gray-500 dark:text-gray-400">
            {{ visibleBundles.length ? (t('app.noBundlesForInterval') || 'Сборок с таким периодом нет') : (t('app.noBundlesYet') || 'Готовых сборок пока нет') }}
          </p>
        </div>

        <!-- Bundles grid -->
        <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          <div
            v-for="b in displayedBundles"
            :key="b.id"
            class="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 overflow-hidden group"
          >
            <!-- Trial ribbon -->
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

              <!-- Price -->
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
                    / {{ selectedInterval === 'monthly' ? (t('app.month') || 'мес') : (t('app.year') || 'год') }}
                  </span>
                </div>
                <div v-if="b.trialDays > 0" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {{ t('app.afterTrial') || 'После пробного периода' }}:
                  <span class="font-semibold">{{ formatPrice(b.amountCents, b.currency) }}</span>
                  / {{ selectedInterval === 'monthly' ? (t('app.month') || 'мес') : (t('app.year') || 'год') }}
                </div>
              </div>

              <!-- Included apps -->
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

              <!-- CTA -->
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
                class="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
                {{ t('app.activePlan') || 'Подключено!' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Comparison table -->
        <div class="max-w-6xl mx-auto">
          <BundleComparisonTable
            :bundles="displayedBundles"
            :plan-lookup="planLookup"
            :active-codes="activeCodes"
          />
        </div>

        <LegalLinks context="payment" class="mt-8" />
      </template>
    </div>
  </div>
</template>
