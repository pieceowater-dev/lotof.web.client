<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsTopGoodsEntry, GoodsAbcEntry, GoodsMarginReport } from '@/api/goods/analytics';
import type { GoodsStock } from '@/api/goods/stock';
import type { GoodsBatch } from '@/api/goods/goodbatch';
import type { GoodsGood } from '@/api/goods/good';
import GoodsNavTabs from '@/components/goods/GoodsNavTabs.vue';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.reports')} — ${titleBySlug(nsSlug.value)}` : t('goods.reports'),
}));

const { getToken: getGoodsTokenRaw } = useGoodsAuth();
async function getToken(): Promise<string> {
  return getGoodsTokenRaw(nsSlug.value);
}

const TABS = [
  { key: 'top', labelKey: 'goods.topGoods', icon: 'lucide:trending-up' },
  { key: 'abc', labelKey: 'goods.abcAnalysis', icon: 'lucide:layers' },
  { key: 'margin', labelKey: 'goods.marginReport', icon: 'lucide:percent' },
  { key: 'alerts', labelKey: 'goods.lowStockAlerts', icon: 'lucide:bell' },
] as const;
const activeTab = ref<(typeof TABS)[number]['key']>('top');
const loading = ref(false);
const goods = ref<GoodsGood[]>([]);
const goodName = (id: string) => goods.value.find((g) => g.id === id)?.name || id;

const today = new Date();
const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
const from = ref(monthAgo.toISOString().slice(0, 10));
const to = ref(today.toISOString().slice(0, 10));

const topGoods = ref<GoodsTopGoodsEntry[]>([]);
const abcEntries = ref<GoodsAbcEntry[]>([]);
const marginReport = ref<GoodsMarginReport | null>(null);
const lowStock = ref<GoodsStock[]>([]);
const expiringBatches = ref<GoodsBatch[]>([]);

// Lightweight bar visualization without pulling in a charting dependency --
// each row's bar is sized relative to the largest value in the list.
const maxRevenue = computed(() => Math.max(1, ...topGoods.value.map((e) => e.revenueCents)));

function rangeIso() {
  return { from: new Date(from.value).toISOString(), to: new Date(to.value + 'T23:59:59').toISOString() };
}

async function loadReport() {
  loading.value = true;
  try {
    const token = await getToken();
    const { from: f, to: tt } = rangeIso();
    if (activeTab.value === 'top') {
      const { goodsTopGoods } = await import('@/api/goods/analytics');
      topGoods.value = await goodsTopGoods(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'abc') {
      const { goodsAbcAnalysis } = await import('@/api/goods/analytics');
      abcEntries.value = await goodsAbcAnalysis(token, nsSlug.value, f, tt);
    } else if (activeTab.value === 'margin') {
      const { goodsMarginReport } = await import('@/api/goods/analytics');
      marginReport.value = await goodsMarginReport(token, nsSlug.value, f, tt);
    } else {
      const { goodsListStock } = await import('@/api/goods/stock');
      const { goodsListExpiringBatches } = await import('@/api/goods/goodbatch');
      const [{ stock }, batches] = await Promise.all([
        goodsListStock(token, nsSlug.value, { lowStockOnly: true }),
        goodsListExpiringBatches(token, nsSlug.value),
      ]);
      lowStock.value = stock;
      expiringBatches.value = batches;
    }
  } catch (e) {
    logError('[goods/reports] loadReport failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load report', color: 'red' });
  } finally {
    loading.value = false;
  }
}

watch(activeTab, loadReport);

onMounted(async () => {
  try {
    const token = await getToken();
    const { goodsListGoods } = await import('@/api/goods/good');
    const { goods: g } = await goodsListGoods(token, nsSlug.value);
    goods.value = g;
  } catch {}
  await loadReport();
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex-shrink-0">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('goods.reports') }}</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ t('goods.reportsSubtitle') }}</p>
    </div>

    <div class="flex-shrink-0 mt-3">
      <GoodsNavTabs />
    </div>

    <div class="flex items-center gap-2 overflow-x-auto pb-1 mt-3 flex-shrink-0">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap flex items-center gap-1.5"
        :class="activeTab === tab.key
          ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:border-primary-900/60'
          : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
        @click="activeTab = tab.key"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" />
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <div v-if="activeTab !== 'alerts'" class="flex items-center gap-2 flex-shrink-0 mt-3">
      <UFormGroup :label="t('goods.dateFrom')"><UInput v-model="from" type="date" size="sm" /></UFormGroup>
      <UFormGroup :label="t('goods.dateTo')"><UInput v-model="to" type="date" size="sm" /></UFormGroup>
      <UButton class="mt-5" size="sm" color="gray" variant="soft" :loading="loading" @click="loadReport">{{ t('common.ok') }}</UButton>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto mt-3">
      <div v-if="loading" class="text-center py-10 text-gray-400"><Icon name="lucide:loader" class="w-6 h-6 animate-spin mx-auto" /></div>

      <div v-else-if="activeTab === 'top'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="e in topGoods" :key="e.goodId" class="px-4 py-2.5 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ e.goodName }}</span>
            <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ e.quantitySold }} · {{ (e.revenueCents / 100).toFixed(2) }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div class="h-full rounded-full bg-primary-400 dark:bg-primary-600" :style="{ width: `${(e.revenueCents / maxRevenue) * 100}%` }" />
          </div>
        </div>
        <div v-if="!topGoods.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>

      <div v-else-if="activeTab === 'abc'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="e in abcEntries" :key="e.goodId" class="px-4 py-2.5 text-sm space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ e.goodName }}</span>
            <div class="flex items-center gap-2">
              <UBadge :color="e.class === 'A' ? 'green' : e.class === 'B' ? 'amber' : 'gray'" variant="soft" size="xs">{{ e.class }}</UBadge>
              <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ (e.revenueCents / 100).toFixed(2) }} ({{ e.revenueSharePercent.toFixed(1) }}%)</span>
            </div>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              class="h-full rounded-full"
              :class="e.class === 'A' ? 'bg-emerald-500' : e.class === 'B' ? 'bg-amber-500' : 'bg-gray-400'"
              :style="{ width: `${Math.min(100, e.revenueSharePercent)}%` }"
            />
          </div>
        </div>
        <div v-if="!abcEntries.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>

      <div v-else-if="activeTab === 'margin' && marginReport" class="space-y-3">
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ (marginReport.totalRevenueCents / 100).toFixed(2) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.total') }}</div>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ (marginReport.totalCostCents / 100).toFixed(2) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.costPrice') }}</div>
          </div>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div class="text-2xl font-bold tabular-nums" :class="marginReport.totalMarginCents >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
              {{ (marginReport.totalMarginCents / 100).toFixed(2) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('goods.marginReport') }} ({{ marginReport.totalMarginPercent.toFixed(1) }}%)</div>
          </div>
        </div>
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="e in marginReport.entries" :key="e.saleId" class="flex items-center justify-between px-4 py-2.5 text-sm">
            <span class="font-medium">{{ e.number }}</span>
            <span class="tabular-nums text-gray-500 dark:text-gray-400">{{ (e.marginCents / 100).toFixed(2) }} ({{ e.marginPercent.toFixed(1) }}%)</span>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'alerts'" class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{{ t('goods.lowStockAlerts') }}</h3>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="s in lowStock" :key="`${s.warehouseId}-${s.goodId}`" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <span class="font-medium">{{ goodName(s.goodId) }}</span>
              <UBadge color="amber" variant="soft">{{ s.available }}</UBadge>
            </div>
            <div v-if="!lowStock.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{{ t('goods.expiringBatches') }}</h3>
          <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="b in expiringBatches" :key="b.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
              <span class="font-medium">{{ goodName(b.goodId) }} <span v-if="b.batchNumber" class="text-gray-400">({{ b.batchNumber }})</span></span>
              <UBadge color="red" variant="soft">{{ b.expiryDate }}</UBadge>
            </div>
            <div v-if="!expiringBatches.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
