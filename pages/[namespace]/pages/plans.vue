<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePagesAccess } from '@/composables/usePagesAccess';
import { usePageTitle } from '@/composables/usePageTitle';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { useDowngradeBlockedModal, parseDowngradeRegressions } from '@/composables/useDowngradeBlockedModal';
import { pagesApi, type PagesTariff, type PagesSubscription } from '@/api/pages/ops';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

// Plan picker for lota Pages. Owner only.
const APP_BUNDLE = 'pieceowater.pages';
const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();
const { getToken } = usePagesAuth();
const { load: loadAccess, isOwner, loaded: accessLoaded } = usePagesAccess(() => nsSlug.value);
usePageTitle('pages');

const booting = ref(true);
const plans = ref<PagesTariff[]>([]);
const active = ref<PagesSubscription | null>(null);
const interval = ref<'MONTH' | 'YEAR'>('MONTH');
const busy = ref<string | null>(null);

async function load() {
  try {
    await getToken(nsSlug.value);
    await loadAccess();
    if (!isOwner.value) { await navigateTo(`/${nsSlug.value}/pages`); return; }
    [plans.value, active.value] = await Promise.all([pagesApi.tariffs(nsSlug.value), pagesApi.subscription(nsSlug.value).catch(() => null)]);
    const cur = plans.value.find(p => p.id === active.value?.planId);
    if (cur) interval.value = cur.interval;
  } catch (e) {
    logError('[pages/plans] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    booting.value = false;
  }
}
onMounted(load);

const shown = computed(() => plans.value.filter(p => p.interval === interval.value).sort((a, b) => a.amountCents - b.amountCents));
const hasYear = computed(() => plans.value.some(p => p.interval === 'YEAR'));
const isActive = (p: PagesTariff) => active.value?.planId === p.id;
const price = (p: PagesTariff) => (p.amountCents === 0 ? t('pages.plan.free') : p.currency === 'KZT' ? `${(p.amountCents / 100).toLocaleString('ru-KZ')}₸` : `${p.currency} ${(p.amountCents / 100).toLocaleString()}`);

function features(p: PagesTariff): { key: string; value: number | string }[] {
  try {
    const m = JSON.parse(p.metadataJson || '{}');
    return Array.isArray(m.features) ? m.features : [];
  } catch { return []; }
}
const featureText = (f: { key: string; value: number | string }) =>
  t('app.planFeature.' + f.key, { value: f.value as any }) || `${f.key.replace(/^max_/, '').replace(/_/g, ' ')}: ${f.value}`;

async function choose(p: PagesTariff) {
  // paid plans are connected through support, same as the other lota apps
  if (p.amountCents > 0 && p.trialDays === 0) { useContactUsModal().open({ app: APP_BUNDLE, planName: p.name }); return; }
  busy.value = p.code;
  try {
    active.value = await pagesApi.subscribe(nsSlug.value, p.code);
    toast.add({ title: t('pages.plan.done'), description: p.name, color: 'emerald' });
    await navigateTo(`/${nsSlug.value}/pages/plan`);
  } catch (e) {
    const msg = getErrorMessage(e, t) || t('common.errorRetry');
    const regressions = parseDowngradeRegressions(msg);
    if (regressions) useDowngradeBlockedModal().open(regressions);
    else toast.add({ title: t('common.error'), description: msg, color: 'red' });
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <PageHeader :title="t('pages.plan.chooseTitle')" :subtitle="t('pages.plan.chooseSubtitle')" :back-to="`/${nsSlug}/pages/plan`" :back-label="t('pages.plan.title')" />

    <AppSkeleton v-if="booting || !accessLoaded" variant="cards" :rows="3" />

    <template v-else>
      <div v-if="hasYear" class="flex gap-2">
        <button type="button" class="pill-filter" :class="interval === 'MONTH' ? 'pill-filter--active' : ''" @click="interval = 'MONTH'">{{ t('app.monthly') }}</button>
        <button type="button" class="pill-filter" :class="interval === 'YEAR' ? 'pill-filter--active' : ''" @click="interval = 'YEAR'">{{ t('app.yearly') }}</button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="p in shown" :key="p.id" class="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 dark:bg-[#1f1f1f]" :class="isActive(p) ? 'ring-2 ring-emerald-500' : 'ring-black/5 dark:ring-white/10'">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ p.name }}</h3>
          <p v-if="p.description" class="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{{ p.description }}</p>
          <div class="flex items-baseline gap-1">
            <span class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{{ price(p) }}</span>
            <span v-if="p.amountCents > 0" class="text-sm text-gray-500 dark:text-gray-400">{{ p.interval === 'YEAR' ? t('pages.plan.perYear') : t('pages.plan.perMonth') }}</span>
          </div>
          <ul class="flex flex-1 flex-col gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
            <li v-for="f in features(p)" :key="f.key" class="flex items-start gap-2">
              <UIcon name="lucide:check" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />{{ featureText(f) }}
            </li>
          </ul>
          <div v-if="isActive(p)" class="flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <UIcon name="lucide:check-circle" class="h-4 w-4" />{{ t('pages.plan.active') }}
          </div>
          <button v-else type="button" class="cta-pill cta-pill--primary w-full justify-center disabled:opacity-50" :disabled="busy !== null" @click="choose(p)">
            <UIcon v-if="busy === p.code" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
            {{ t('pages.plan.select') }}
          </button>
        </div>
      </div>
      <p v-if="!shown.length" class="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('app.noPlansAvailable') }}</p>
    </template>
  </div>
</template>
