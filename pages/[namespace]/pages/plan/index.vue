<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import PageHeader from '@/components/ui/PageHeader.vue';
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePagesAccess } from '@/composables/usePagesAccess';
import { usePageTitle } from '@/composables/usePageTitle';
import { pagesApi, type PagesPlan, type PagesUsage } from '@/api/pages/ops';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

// The namespace's tariff and what it uses of it. Owner only.
const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const toast = useToast();
const { getToken } = usePagesAuth();
const { load: loadAccess, isOwner, loaded: accessLoaded } = usePagesAccess(() => nsSlug.value);
usePageTitle('pages');

const booting = ref(true);
const plan = ref<PagesPlan | null>(null);
const usage = ref<PagesUsage | null>(null);

async function load() {
  try {
    await getToken(nsSlug.value);
    await loadAccess();
    if (!isOwner.value) { await navigateTo(`/${nsSlug.value}/pages`); return; }
    [plan.value, usage.value] = await Promise.all([pagesApi.plan(nsSlug.value).catch(() => null), pagesApi.usage(nsSlug.value)]);
  } catch (e) {
    logError('[pages/plan] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    booting.value = false;
  }
}
onMounted(load);

// Capital stores limits either as {"features":[{"key","value"}]} or as a flat object.
const limits = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  try {
    const o = JSON.parse(plan.value?.limitsJson || '{}');
    for (const [k, v] of Object.entries(o)) if (typeof v === 'number') out[k] = v;
    if (Array.isArray(o.features)) for (const f of o.features) if (f?.key && typeof f.value === 'number') out[f.key] = f.value;
  } catch { /* no limits */ }
  return out;
});

const MB = 1024 * 1024;
const fmtBytes = (n: number) => (n >= 1024 * MB ? `${(n / (1024 * MB)).toFixed(1)} GB` : n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(0, Math.round(n / 1024))} KB`);

const bars = computed(() => {
  const u = usage.value;
  if (!u) return [];
  const mk = (key: string, label: string, used: number, limit: number) => ({ key, label, used, limit, pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0 });
  return [
    mk('sites', t('pages.usage.sites'), u.sites, limits.value.max_sites || 0),
    mk('pages', t('pages.usage.pages'), u.pages, limits.value.max_pages || 0),
  ];
});

// Donut: media + published versions against the disk quota (or against their own sum when unlimited).
const R = 52;
const C = 2 * Math.PI * R;
const disk = computed(() => {
  const u = usage.value;
  const media = u?.mediaBytes || 0;
  const pub = u?.publishedBytes || 0;
  const quota = (limits.value.storage_mb || 0) * MB;
  const total = quota > 0 ? Math.max(quota, media + pub) : Math.max(media + pub, 1);
  const seg = (v: number) => (v / total) * C;
  return {
    media, pub, quota, used: media + pub, free: quota > 0 ? Math.max(0, quota - media - pub) : 0,
    mediaLen: seg(media), pubLen: seg(pub), pubOffset: -seg(media),
    pct: quota > 0 ? Math.min(100, Math.round(((media + pub) / quota) * 100)) : 0,
  };
});
</script>

<template>
  <div class="at-scope ct-scope h-full min-h-0 overflow-y-auto p-4 pb-safe-or-4 flex flex-col gap-4 [&>*]:flex-shrink-0">
    <PageHeader :title="t('pages.plan.title')" :subtitle="t('pages.plan.subtitle')" :back-to="`/${nsSlug}/pages?all=1`" :back-label="t('pages.title')">
      <template #actions>
        <NuxtLink :to="`/${nsSlug}/pages/plans`" class="cta-pill cta-pill--primary">
          <UIcon name="lucide:sliders-horizontal" class="h-4 w-4" />
          {{ t('pages.plan.configure') }}
        </NuxtLink>
      </template>
    </PageHeader>

    <AppSkeleton v-if="booting || !accessLoaded" variant="cards" :rows="2" />

    <template v-else>
      <p v-if="plan" class="text-sm text-gray-600 dark:text-gray-300">{{ t('pages.plan.current', { name: plan.planName || plan.planCode }) }}</p>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:flex-row dark:bg-[#1f1f1f] dark:ring-white/10">
          <div class="relative h-40 w-40 flex-shrink-0">
            <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
              <circle cx="60" cy="60" :r="R" fill="none" stroke-width="14" class="stroke-gray-100 dark:stroke-white/10" />
              <circle cx="60" cy="60" :r="R" fill="none" stroke-width="14" class="stroke-blue-500" :stroke-dasharray="`${disk.mediaLen} ${C}`" />
              <circle cx="60" cy="60" :r="R" fill="none" stroke-width="14" class="stroke-emerald-500" :stroke-dasharray="`${disk.pubLen} ${C}`" :stroke-dashoffset="disk.pubOffset" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{{ disk.quota > 0 ? `${disk.pct}%` : fmtBytes(disk.used) }}</span>
              <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('pages.plan.diskUsed') }}</span>
            </div>
          </div>
          <div class="min-w-0 flex-1 text-sm">
            <h3 class="mb-2 font-semibold text-gray-900 dark:text-white">
              {{ t('pages.plan.diskTitle') }}
              <span v-if="disk.quota > 0" class="font-normal text-gray-500 dark:text-gray-400">{{ t('pages.plan.diskOf', { limit: fmtBytes(disk.quota) }) }}</span>
            </h3>
            <div class="flex items-center justify-between gap-3"><span class="flex items-center gap-2"><i class="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />{{ t('pages.plan.diskMedia') }}</span><span class="tabular-nums text-gray-500 dark:text-gray-400">{{ fmtBytes(disk.media) }}</span></div>
            <div class="mt-1 flex items-center justify-between gap-3"><span class="flex items-center gap-2"><i class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />{{ t('pages.plan.diskPublished') }}</span><span class="tabular-nums text-gray-500 dark:text-gray-400">{{ fmtBytes(disk.pub) }}</span></div>
            <div v-if="disk.quota > 0" class="mt-1 flex items-center justify-between gap-3"><span class="flex items-center gap-2"><i class="inline-block h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-white/20" />{{ t('pages.plan.diskFree') }}</span><span class="tabular-nums text-gray-500 dark:text-gray-400">{{ fmtBytes(disk.free) }}</span></div>
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.usage.diskHint') }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
          <div v-for="b in bars" :key="b.key">
            <div class="flex items-baseline justify-between gap-2 text-sm">
              <span class="text-gray-700 dark:text-gray-200">{{ b.label }}</span>
              <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ b.limit > 0 ? t('pages.usage.of', { used: b.used, limit: b.limit }) : t('pages.usage.unlimited', { used: b.used }) }}</span>
            </div>
            <div v-if="b.limit > 0" class="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div class="h-full rounded-full transition-all" :class="b.pct >= 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-600 to-emerald-500'" :style="{ width: `${Math.max(2, b.pct)}%` }" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
