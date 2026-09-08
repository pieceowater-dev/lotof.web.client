<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import { plansApi, type PlansBookingSummary, type PlansMasterLoad, type PlansMaster } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { getToken } = usePlansAuth();

useHead(() => ({ title: `${t('plans.reports')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));

const loading = ref(true);
const summary = ref<PlansBookingSummary | null>(null);
const load = ref<PlansMasterLoad[]>([]);
const masters = ref<PlansMaster[]>([]);
const rangeDays = ref(30);

const from = computed(() => { const d = new Date(); d.setDate(d.getDate() - rangeDays.value); return d.toISOString(); });
const to = computed(() => new Date().toISOString());
const mById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m.name])));

async function loadAll() {
  loading.value = true;
  try {
    const [s, l, m] = await Promise.all([
      plansApi.summarize(nsSlug.value, from.value, to.value),
      plansApi.masterLoad(nsSlug.value, from.value, to.value),
      plansApi.masters(nsSlug.value, true),
    ]);
    summary.value = s; load.value = l; masters.value = m;
  } catch (e) { logError('[plans/reports] load', e); }
  finally { loading.value = false; }
}
function pct(l: PlansMasterLoad) {
  return l.availableMinutes > 0 ? Math.round((l.bookedMinutes / l.availableMinutes) * 100) : 0;
}
onMounted(loadAll);
watch(rangeDays, loadAll);
</script>

<template>
  <div class="max-w-3xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-4">
    <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.reports') }}</h1>
    <PlansNavTabs />

    <div class="flex gap-1.5">
      <UButton v-for="d in [7,30,90]" :key="d" size="xs" :variant="rangeDays === d ? 'solid' : 'soft'" @click="rangeDays = d">{{ d }} {{ t('plans.days') || 'дн' }}</UButton>
    </div>

    <div v-if="loading" class="py-16 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" /></div>
    <template v-else>
      <div v-if="summary" class="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
          <div class="text-2xl font-semibold">{{ summary.total }}</div><div class="text-xs text-gray-500">{{ t('plans.totalBookings') || 'записей' }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
          <div class="text-2xl font-semibold text-emerald-600">{{ summary.completed }}</div><div class="text-xs text-gray-500">{{ t('plans.completed') || 'завершено' }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
          <div class="text-2xl font-semibold text-red-600">{{ summary.cancelled }}</div><div class="text-xs text-gray-500">{{ t('plans.cancelledN') || 'отменено' }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
          <div class="text-2xl font-semibold text-amber-600">{{ summary.noShow }}</div><div class="text-xs text-gray-500">{{ t('plans.noShow') || 'не пришли' }}</div>
        </div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 text-center">
          <div class="text-2xl font-semibold">{{ summary.revenue }}</div><div class="text-xs text-gray-500">{{ t('plans.revenue') || 'выручка' }}</div>
        </div>
      </div>

      <h2 class="font-semibold text-gray-900 dark:text-white mt-2">{{ t('plans.masterLoad') || 'Загрузка мастеров' }}</h2>
      <div v-if="!load.length" class="text-sm text-gray-500 py-4">{{ t('plans.noData') || 'Нет данных' }}</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="l in load" :key="l.masterId" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="font-medium">{{ mById[l.masterId] || l.masterId.slice(0,8) }}</span>
            <span class="text-gray-500">{{ l.bookingCount }} {{ t('plans.bookingsShort') || 'зап.' }} · {{ pct(l) }}%</span>
          </div>
          <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div class="h-full bg-primary-500" :style="{ width: Math.min(pct(l), 100) + '%' }" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
