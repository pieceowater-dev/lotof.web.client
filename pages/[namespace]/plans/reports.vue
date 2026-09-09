<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import { plansApi, type PlansBookingSummary, type PlansMasterLoad, type PlansMaster } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();

useHead(() => ({ title: `${t('plans.reports')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));

const booting = ref(true);
const loading = ref(false);
const summary = ref<PlansBookingSummary | null>(null);
const load = ref<PlansMasterLoad[]>([]);
const masters = ref<PlansMaster[]>([]);
const rangeDays = ref(30);

const from = computed(() => { const d = new Date(); d.setDate(d.getDate() - rangeDays.value); return d.toISOString(); });
const to = computed(() => new Date().toISOString());
const mById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m.name])));

const tiles = computed(() => summary.value ? [
  { label: t('plans.totalBookings') || 'записей', value: summary.value.total, color: 'text-gray-900 dark:text-white', icon: 'lucide:calendar' },
  { label: t('plans.completed') || 'завершено', value: summary.value.completed, color: 'text-emerald-600', icon: 'lucide:check-circle-2' },
  { label: t('plans.cancelledN') || 'отменено', value: summary.value.cancelled, color: 'text-red-500', icon: 'lucide:x-circle' },
  { label: t('plans.noShow') || 'не пришли', value: summary.value.noShow, color: 'text-amber-500', icon: 'lucide:user-x' },
  { label: t('plans.revenue') || 'выручка', value: summary.value.revenue, color: 'text-gray-900 dark:text-white', icon: 'lucide:wallet' },
] : []);

async function loadAll() {
  loading.value = true;
  try {
    const [s, l, m] = await Promise.all([
      plansApi.summarize(nsSlug.value, from.value, to.value),
      plansApi.masterLoad(nsSlug.value, from.value, to.value),
      plansApi.masters(nsSlug.value, true),
    ]);
    summary.value = s; load.value = l.slice().sort((a, b) => b.bookedMinutes - a.bookedMinutes); masters.value = m;
  } catch (e) {
    logError('[plans/reports] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { loading.value = false; }
}
function pct(l: PlansMasterLoad) {
  return l.availableMinutes > 0 ? Math.round((l.bookedMinutes / l.availableMinutes) * 100) : 0;
}

onMounted(async () => {
  try { await getToken(nsSlug.value); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { booting.value = false; }
});
watch(rangeDays, loadAll);
</script>

<template>
  <div class="p-4 pb-safe-or-4 flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.reports') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('plans.reportsSubtitle') || 'Записи, выручка и загрузка мастеров' }}</p>
      </div>
    </div>
    <PlansNavTabs />

    <div class="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-fit p-0.5">
      <button
        v-for="d in [7, 30, 90]" :key="d"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        :class="rangeDays === d ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="rangeDays = d"
      >{{ d }} {{ t('plans.days') || 'дн' }}</button>
    </div>

    <div v-if="booting" class="py-16 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div v-for="tile in tiles" :key="tile.label"
             class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <UIcon :name="tile.icon" class="w-4 h-4 text-gray-400 mb-1.5" />
          <div class="text-2xl font-semibold tabular-nums" :class="tile.color">{{ tile.value }}</div>
          <div class="text-xs text-gray-500">{{ tile.label }}</div>
        </div>
      </div>

      <UCard :ui="{ body: { padding: 'p-3 sm:p-4' } }" class="mt-1">
        <template #header>
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.masterLoad') || 'Загрузка мастеров' }}</h2>
        </template>
        <div v-if="loading" class="py-6 flex justify-center">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" />
        </div>
        <div v-else-if="!load.length" class="text-sm text-gray-500 py-4">{{ t('plans.noData') || 'Нет данных за период' }}</div>
        <div v-else class="flex flex-col gap-3">
          <div v-for="l in load" :key="l.masterId">
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="font-medium text-gray-800 dark:text-gray-100">{{ mById[l.masterId] || l.masterId.slice(0, 8) }}</span>
              <span class="text-gray-500 tabular-nums">{{ l.bookingCount }} {{ t('plans.bookingsShort') || 'зап.' }} · {{ pct(l) }}%</span>
            </div>
            <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div class="h-full rounded-full transition-[width]"
                   :class="pct(l) >= 85 ? 'bg-red-500' : pct(l) >= 55 ? 'bg-amber-500' : 'bg-primary-500'"
                   :style="{ width: Math.min(pct(l), 100) + '%' }" />
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
