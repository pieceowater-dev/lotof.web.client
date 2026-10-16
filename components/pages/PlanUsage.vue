<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { pagesApi, type PagesPlan, type PagesUsage } from '@/api/pages/ops';

// What the namespace uses of its tariff: sites, pages and disk (images + published files).
const props = defineProps<{ nsSlug: string }>();
const { t } = useI18n();

const plan = ref<PagesPlan | null>(null);
const usage = ref<PagesUsage | null>(null);

async function load() {
  try {
    [plan.value, usage.value] = await Promise.all([pagesApi.plan(props.nsSlug).catch(() => null), pagesApi.usage(props.nsSlug)]);
  } catch { /* the card simply does not show */ }
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

const rows = computed(() => {
  const u = usage.value;
  if (!u) return [];
  const disk = u.mediaBytes + u.publishedBytes;
  const mk = (key: string, label: string, used: number, text: string, limit: number, limitText: string) => ({ key, label, used, text, limit, limitText, pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0 });
  return [
    mk('sites', t('pages.usage.sites'), u.sites, String(u.sites), limits.value.max_sites || 0, String(limits.value.max_sites || 0)),
    mk('pages', t('pages.usage.pages'), u.pages, String(u.pages), limits.value.max_pages || 0, String(limits.value.max_pages || 0)),
    mk('disk', t('pages.usage.disk'), disk, fmtBytes(disk), (limits.value.storage_mb || 0) * MB, `${limits.value.storage_mb || 0} MB`),
  ];
});
</script>

<template>
  <div v-if="rows.length" class="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.usage.title') }}</h3>
      <span v-if="plan" class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.usage.plan', { name: plan.planName || plan.planCode }) }}</span>
    </div>
    <div v-for="r in rows" :key="r.key">
      <div class="flex items-baseline justify-between gap-2 text-sm">
        <span class="text-gray-700 dark:text-gray-200">{{ r.label }}</span>
        <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ r.limit > 0 ? t('pages.usage.of', { used: r.text, limit: r.limitText }) : t('pages.usage.unlimited', { used: r.text }) }}</span>
      </div>
      <div v-if="r.limit > 0" class="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div class="h-full rounded-full transition-all" :class="r.pct >= 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-600 to-emerald-500'" :style="{ width: `${Math.max(2, r.pct)}%` }" />
      </div>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.usage.diskHint') }}</p>
  </div>
</template>
