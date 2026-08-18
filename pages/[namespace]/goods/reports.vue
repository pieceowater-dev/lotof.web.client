<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsTopGoodsEntry, GoodsAbcEntry, GoodsMarginReport } from '@/api/goods/analytics';
import type { GoodsStock } from '@/api/goods/stock';
import type { GoodsBatch } from '@/api/goods/goodbatch';
import type { GoodsGood } from '@/api/goods/good';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.reports')} — ${titleBySlug(nsSlug.value)}` : t('goods.reports'),
}));

async function getToken(): Promise<string> {
  const { ensure, current } = useGoodsToken();
  const existing = current();
  if (existing) return existing;
  const { token: hubToken } = useAuth();
  if (!hubToken.value) throw new Error('No hub token');
  const token = await ensure(nsSlug.value, hubToken.value);
  if (!token) throw new Error('No goods token');
  return token;
}

const activeTab = ref<'top' | 'abc' | 'margin' | 'alerts'>('top');
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
  <div class="max-w-5xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.reports') }}</h1>
      <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
    </div>

    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="tab in (['top', 'abc', 'margin', 'alerts'] as const)"
        :key="tab"
        type="button"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px"
        :class="activeTab === tab ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'"
        @click="activeTab = tab"
      >
        {{ tab === 'top' ? t('goods.topGoods') : tab === 'abc' ? t('goods.abcAnalysis') : tab === 'margin' ? t('goods.marginReport') : t('goods.lowStockAlerts') }}
      </button>
    </div>

    <div v-if="activeTab !== 'alerts'" class="flex items-center gap-2">
      <UFormGroup :label="t('goods.dateFrom')"><UInput v-model="from" type="date" size="sm" /></UFormGroup>
      <UFormGroup :label="t('goods.dateTo')"><UInput v-model="to" type="date" size="sm" /></UFormGroup>
      <UButton class="mt-5" size="sm" color="gray" variant="soft" :loading="loading" @click="loadReport">{{ t('common.ok') }}</UButton>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-400"><Icon name="lucide:loader" class="w-6 h-6 animate-spin mx-auto" /></div>

    <div v-else-if="activeTab === 'top'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
      <div v-for="e in topGoods" :key="e.goodId" class="flex items-center justify-between px-4 py-2.5 text-sm">
        <span class="font-medium">{{ e.goodName }}</span>
        <span>{{ e.quantitySold }} · {{ (e.revenueCents / 100).toFixed(2) }}</span>
      </div>
      <div v-if="!topGoods.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
    </div>

    <div v-else-if="activeTab === 'abc'" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
      <div v-for="e in abcEntries" :key="e.goodId" class="flex items-center justify-between px-4 py-2.5 text-sm">
        <span class="font-medium">{{ e.goodName }}</span>
        <div class="flex items-center gap-2">
          <UBadge :color="e.class === 'A' ? 'green' : e.class === 'B' ? 'amber' : 'gray'" variant="soft">{{ e.class }}</UBadge>
          <span>{{ (e.revenueCents / 100).toFixed(2) }} ({{ e.revenueSharePercent.toFixed(1) }}%)</span>
        </div>
      </div>
      <div v-if="!abcEntries.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
    </div>

    <div v-else-if="activeTab === 'margin' && marginReport" class="space-y-3">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-400">{{ t('goods.total') }}</div>
          <div class="font-bold">{{ (marginReport.totalRevenueCents / 100).toFixed(2) }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-400">{{ t('goods.costPrice') }}</div>
          <div class="font-bold">{{ (marginReport.totalCostCents / 100).toFixed(2) }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-400">{{ t('goods.marginReport') }}</div>
          <div class="font-bold">{{ (marginReport.totalMarginCents / 100).toFixed(2) }} ({{ marginReport.totalMarginPercent.toFixed(1) }}%)</div>
        </div>
      </div>
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="e in marginReport.entries" :key="e.saleId" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <span class="font-medium">{{ e.number }}</span>
          <span>{{ (e.marginCents / 100).toFixed(2) }} ({{ e.marginPercent.toFixed(1) }}%)</span>
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
</template>
