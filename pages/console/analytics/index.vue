<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <AdminHeader
      :title="t('admin.analytics')"
      :description="t('admin.analyticsDesc')"
    >
      <template #actions>
        <button
          class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          :disabled="loading"
          @click="load"
        >
          <Icon name="lucide:refresh-cw" class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
          {{ t('admin.refresh') }}
        </button>
      </template>
    </AdminHeader>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <Icon name="svg-spinners:ring-resize" class="h-10 w-10 text-blue-600" />
        <p class="text-slate-500 animate-pulse">{{ t('admin.loadingAnalytics') }}</p>
      </div>

      <div v-else-if="loadError" class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
        {{ loadError }}
      </div>

      <div v-else class="space-y-10">
        <!-- KPI cards -->
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div
            v-for="card in kpiCards"
            :key="card.label"
            class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ card.label }}</div>
                <div class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ card.value }}</div>
                <div v-if="card.sub" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ card.sub }}</div>
              </div>
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" :class="card.iconBg">
                <Icon :name="card.icon" class="h-4.5 w-4.5" :class="card.iconColor" />
              </div>
            </div>
          </div>
        </div>

        <!-- Namespace growth -->
        <div class="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-1 flex items-center justify-between">
            <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.namespaceGrowth') }}</h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ t('admin.cumulativeTotal') }}</span>
          </div>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">{{ t('admin.namespaceGrowthDesc') }}</p>

          <div v-if="growthSeries.length < 2" class="py-10 text-center text-sm text-slate-400">
            {{ t('admin.notEnoughData') }}
          </div>
          <div v-else class="relative">
            <svg
              :viewBox="`0 0 ${chartW} ${chartH}`"
              class="h-56 w-full overflow-visible"
              preserveAspectRatio="none"
              @mousemove="onGrowthHover"
              @mouseleave="growthHoverIndex = null"
            >
              <!-- baseline -->
              <line :x1="padL" :y1="chartH - padB" :x2="chartW - padR" :y2="chartH - padB" class="stroke-slate-200 dark:stroke-slate-800" stroke-width="1" />
              <!-- area -->
              <polygon :points="growthAreaPoints" class="fill-blue-500/10 dark:fill-blue-400/10" />
              <!-- line -->
              <polyline :points="growthLinePoints" fill="none" class="stroke-blue-600 dark:stroke-blue-400" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              <!-- markers -->
              <circle
                v-for="(p, i) in growthPointCoords"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                class="fill-white stroke-blue-600 dark:fill-slate-900 dark:stroke-blue-400"
                stroke-width="2"
              />
              <!-- hover crosshair -->
              <line
                v-if="growthHoverIndex !== null"
                :x1="growthPointCoords[growthHoverIndex].x"
                :y1="padT"
                :x2="growthPointCoords[growthHoverIndex].x"
                :y2="chartH - padB"
                class="stroke-slate-300 dark:stroke-slate-700"
                stroke-width="1"
                stroke-dasharray="3,3"
              />
            </svg>
            <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{{ growthSeries[0]?.label }}</span>
              <span>{{ growthSeries[growthSeries.length - 1]?.label }}</span>
            </div>
            <div
              v-if="growthHoverIndex !== null"
              class="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
              :style="growthTooltipStyle"
            >
              <div class="font-semibold text-slate-900 dark:text-white">{{ growthSeries[growthHoverIndex].label }}</div>
              <div class="text-slate-500 dark:text-slate-400">{{ growthSeries[growthHoverIndex].value }} {{ t('admin.namespacesLower') }}</div>
            </div>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Per-app breakdown -->
          <div class="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 class="mb-1 font-bold text-slate-900 dark:text-white">{{ t('admin.activeSubscriptionsByApp') }}</h3>
            <p class="mb-5 text-xs text-slate-500 dark:text-slate-400">{{ t('admin.activeSubscriptionsByAppDesc') }}</p>
            <div v-if="!appBars.some(b => b.value > 0)" class="py-10 text-center text-sm text-slate-400">
              {{ t('admin.notEnoughData') }}
            </div>
            <div v-else class="flex h-48 items-end gap-6 px-2">
              <div v-for="bar in appBars" :key="bar.key" class="group flex flex-1 flex-col items-center">
                <div class="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{{ bar.value }}</div>
                <div class="flex h-36 w-full items-end">
                  <div
                    class="w-full rounded-t-md transition-all"
                    :class="bar.colorClass"
                    :style="{ height: barHeightPct(bar.value, appBarsMax) + '%' }"
                    :title="`${bar.label}: ${bar.value}`"
                  />
                </div>
                <span class="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">{{ bar.label }}</span>
              </div>
            </div>
          </div>

          <!-- Publications by category -->
          <div class="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 class="mb-1 font-bold text-slate-900 dark:text-white">{{ t('admin.publicationsByCategory') }}</h3>
            <p class="mb-5 text-xs text-slate-500 dark:text-slate-400">{{ t('admin.publicationsByCategoryDesc') }}</p>
            <div v-if="!pubBars.some(b => b.value > 0)" class="py-10 text-center text-sm text-slate-400">
              {{ t('admin.notEnoughData') }}
            </div>
            <div v-else class="flex h-48 items-end gap-3 px-2">
              <div v-for="bar in pubBars" :key="bar.key" class="group flex flex-1 flex-col items-center">
                <div class="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">{{ bar.value }}</div>
                <div class="flex h-36 w-full items-end">
                  <div
                    class="w-full rounded-t-md transition-all"
                    :class="bar.colorClass"
                    :style="{ height: barHeightPct(bar.value, pubBarsMax) + '%' }"
                    :title="`${bar.label}: ${bar.value}`"
                  />
                </div>
                <span class="mt-2 text-center text-[11px] font-medium leading-tight text-slate-600 dark:text-slate-400">{{ bar.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent namespaces -->
        <div>
          <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            {{ t('admin.recentNamespaces') }}
          </h3>
          <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.slug') }}</th>
                  <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.created') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!recentNamespaces.length">
                  <td colspan="3" class="px-6 py-6 text-center text-slate-500">{{ t('admin.notEnoughData') }}</td>
                </tr>
                <tr
                  v-for="ns in recentNamespaces"
                  :key="ns.id"
                  class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ ns.title }}</td>
                  <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ ns.slug }}</td>
                  <td class="px-6 py-3 text-slate-600 dark:text-slate-400">{{ formatDate(ns.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { hubGetAdminNamespaces, type AdminNamespaceRow } from '@/api/hub/admin';
import { capitalGetAdminBillingInfo, type AdminBillingInfo } from '@/api/capital/admin';
import { capitalListPublications } from '@/api/publications';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { token, fetchUser, initialized } = useAuth();

const loading = ref(true);
const loadError = ref('');
const namespaces = ref<AdminNamespaceRow[]>([]);
const billingData = ref<AdminBillingInfo | null>(null);
const publicationCounts = ref<Record<string, number>>({});

async function load() {
  if (!token.value) return;
  loading.value = true;
  loadError.value = '';
  try {
    const [nsResult, billingResult, pubResult] = await Promise.all([
      hubGetAdminNamespaces(token.value),
      capitalGetAdminBillingInfo(token.value, 1, 500),
      capitalListPublications(token.value, { page: 1, pageSize: 1, includeDraft: true }),
    ]);
    namespaces.value = nsResult.rows;
    billingData.value = billingResult;
    publicationCounts.value = pubResult.counts || {};
  } catch (e: any) {
    loadError.value = e?.message || 'Не удалось загрузить аналитику';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!token.value && !initialized.value) {
    await fetchUser();
  }
  load();
});

// ─── KPI cards ──────────────────────────────────────────────────────────
const activeSubscriptions = computed(() => {
  const subs = billingData.value?.adminSubscriptions?.subscriptions || [];
  return subs.filter(s => s.status === 'ACTIVE').length;
});

const newNamespacesLast30Days = computed(() => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return namespaces.value.filter(n => n.createdAt && new Date(n.createdAt).getTime() >= cutoff).length;
});

const kpiCards = computed(() => [
  {
    label: t('admin.totalNamespaces'),
    value: String(namespaces.value.length),
    sub: `+${newNamespacesLast30Days.value} ${t('admin.last30DaysShort')}`,
    icon: 'lucide:box',
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: t('admin.billingAccounts'),
    value: String(billingData.value?.adminAccounts?.total ?? 0),
    icon: 'lucide:building-2',
    iconBg: 'bg-orange-50 dark:bg-orange-900/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: t('admin.activeSubscriptions'),
    value: String(activeSubscriptions.value),
    icon: 'lucide:credit-card',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: t('admin.pricingPlans'),
    value: String((billingData.value?.adminPlans || []).filter(p => p.status !== 'PLAN_ARCHIVED').length),
    icon: 'lucide:tag',
    iconBg: 'bg-violet-50 dark:bg-violet-900/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: t('admin.publications'),
    value: String(publicationCounts.value.all ?? 0),
    icon: 'lucide:newspaper',
    iconBg: 'bg-rose-50 dark:bg-rose-900/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
]);

// ─── Namespace growth chart (single series -> sequential blue, no legend) ─
const chartW = 600;
const chartH = 220;
const padL = 8;
const padR = 8;
const padT = 12;
const padB = 24;

const growthSeries = computed(() => {
  const withDates = namespaces.value
    .filter(n => !!n.createdAt)
    .map(n => new Date(n.createdAt as string).getTime())
    .sort((a, b) => a - b);
  if (withDates.length < 2) return [];

  // Adaptive bucketing: a young/small platform's whole history can fit in a
  // single calendar month, which would otherwise render as one useless
  // point. Bucket by day when the data spans less than ~6 weeks, by month
  // once there's enough history for monthly granularity to be readable.
  const spanDays = (withDates[withDates.length - 1] - withDates[0]) / (24 * 60 * 60 * 1000);
  const byDay = spanDays < 42;

  const bucketKey = (ts: number) => {
    const d = new Date(ts);
    return byDay
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const counts = new Map<string, number>();
  for (const ts of withDates) {
    const key = bucketKey(ts);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const buckets = Array.from(counts.keys()).sort();
  let cumulative = 0;
  return buckets.map(key => {
    cumulative += counts.get(key) || 0;
    const parts = key.split('-').map(Number);
    const date = byDay ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(parts[0], parts[1] - 1, 1);
    const label = byDay
      ? date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
      : date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
    return { label, value: cumulative };
  });
});

const growthPointCoords = computed(() => {
  const series = growthSeries.value;
  if (series.length < 2) return [];
  const maxVal = Math.max(...series.map(s => s.value), 1);
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  return series.map((s, i) => ({
    x: padL + (innerW * i) / (series.length - 1),
    y: padT + innerH - (innerH * s.value) / maxVal,
  }));
});

const growthLinePoints = computed(() => growthPointCoords.value.map(p => `${p.x},${p.y}`).join(' '));
const growthAreaPoints = computed(() => {
  const pts = growthPointCoords.value;
  if (!pts.length) return '';
  const base = chartH - padB;
  return `${padL},${base} ` + pts.map(p => `${p.x},${p.y}`).join(' ') + ` ${chartW - padR},${base}`;
});

const growthHoverIndex = ref<number | null>(null);
function onGrowthHover(e: MouseEvent) {
  const pts = growthPointCoords.value;
  if (!pts.length) return;
  const target = e.currentTarget as SVGSVGElement;
  const rect = target.getBoundingClientRect();
  const relX = ((e.clientX - rect.left) / rect.width) * chartW;
  let closest = 0;
  let closestDist = Infinity;
  pts.forEach((p, i) => {
    const dist = Math.abs(p.x - relX);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  });
  growthHoverIndex.value = closest;
}
const growthTooltipStyle = computed(() => {
  if (growthHoverIndex.value === null || !growthPointCoords.value.length) return {};
  const p = growthPointCoords.value[growthHoverIndex.value];
  const leftPct = (p.x / chartW) * 100;
  const topPct = (p.y / chartH) * 100;
  return {
    left: `calc(${leftPct}% + 8px)`,
    top: `calc(${topPct}% - 8px)`,
  };
});

// ─── Per-app active subscriptions (categorical slots 1-3: blue/orange/aqua) ─
const APPS = [
  { key: 'atrace', label: 'A-Trace', match: 'atrace', colorClass: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'contacts', label: 'Contacts', match: 'contacts', colorClass: 'bg-orange-500 dark:bg-orange-500' },
  { key: 'menu', label: 'Orders', match: 'menu', colorClass: 'bg-teal-500 dark:bg-teal-400' },
] as const;

const appBars = computed(() => {
  const subs = (billingData.value?.adminSubscriptions?.subscriptions || []).filter(s => s.status === 'ACTIVE');
  const plans = billingData.value?.adminPlans || [];
  return APPS.map(app => {
    const count = subs.filter(s => {
      const plan = plans.find(p => p.id === s.planId);
      return plan?.code?.toLowerCase().includes(app.match);
    }).length;
    return { key: app.key, label: app.label, value: count, colorClass: app.colorClass };
  });
});
const appBarsMax = computed(() => Math.max(...appBars.value.map(b => b.value), 1));

// ─── Publications by category (categorical slots 1-5) ────────────────────
const PUB_CATEGORIES = [
  { key: 'news', label: 'News', colorClass: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'blog', label: 'Blog', colorClass: 'bg-orange-500 dark:bg-orange-500' },
  { key: 'whatsnew', label: "What's new", colorClass: 'bg-teal-500 dark:bg-teal-400' },
  { key: 'articles', label: 'Articles', colorClass: 'bg-amber-500 dark:bg-amber-400' },
  { key: 'academy', label: 'Academy', colorClass: 'bg-pink-500 dark:bg-pink-400' },
] as const;

const pubBars = computed(() => PUB_CATEGORIES.map(cat => ({
  key: cat.key,
  label: cat.label,
  value: Number(publicationCounts.value[cat.key] || 0),
  colorClass: cat.colorClass,
})));
const pubBarsMax = computed(() => Math.max(...pubBars.value.map(b => b.value), 1));

function barHeightPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

// ─── Recent namespaces table ───────────────────────────────────────────
const recentNamespaces = computed(() => {
  return [...namespaces.value]
    .filter(n => !!n.createdAt)
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    .slice(0, 10);
});

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}
</script>
