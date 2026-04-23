<template>
  <div class="min-h-screen bg-white dark:bg-slate-950">
    <!-- Header -->
    <AdminHeader 
      :title="t('admin.analytics')" 
      :description="t('admin.analyticsDesc')" 
    />

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Filters -->
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="overflow-x-auto sm:overflow-visible">
          <div class="flex min-w-max gap-3 pr-1">
          <button
            v-for="period in periods"
            :key="period.value"
            @click="selectedPeriod = period.value"
            :class="[
              'shrink-0 whitespace-nowrap px-4 py-2 rounded-lg font-semibold transition-all duration-200',
              selectedPeriod === period.value
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            ]"
          >
            {{ period.label }}
          </button>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid gap-4 md:grid-cols-4 mb-8">
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.activeUsers') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">1,234</div>
            </div>
            <Icon name="lucide:users" class="h-8 w-8 text-blue-600 dark:text-blue-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.totalRequests') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">45.2K</div>
            </div>
            <Icon name="lucide:zap" class="h-8 w-8 text-emerald-600 dark:text-emerald-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.totalNamespaces') }}</div>
              <div class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{{ namespaces.length }}</div>
            </div>
            <Icon name="lucide:box" class="h-8 w-8 text-orange-600 dark:text-orange-400 opacity-20" />
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('admin.apiHealth') }}</div>
              <div class="mt-2 flex items-center gap-2">
                <div class="h-3 w-3 rounded-full bg-green-600 dark:bg-green-400" />
                <span class="font-semibold text-slate-900 dark:text-white">{{ t('admin.healthy') }}</span>
              </div>
            </div>
            <Icon name="lucide:check-circle" class="h-8 w-8 text-green-600 dark:text-green-400 opacity-20" />
          </div>
        </div>
      </div>

      <!-- Charts Placeholder -->
      <div class="grid gap-6 lg:grid-cols-2 mb-8">
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.usageTrends') }}</h3>
          <div class="mt-6 h-64">
            <div class="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Apr 01</span>
              <span>Apr 30</span>
            </div>
            <svg viewBox="0 0 100 40" class="h-52 w-full overflow-visible">
              <polyline
                fill="none"
                stroke="currentColor"
                class="text-slate-300 dark:text-slate-700"
                stroke-width="0.5"
                points="0,35 100,35"
              />
              <polyline
                fill="none"
                stroke="currentColor"
                class="text-blue-500"
                stroke-width="1.5"
                points="0,31 10,28 20,29 30,24 40,26 50,18 60,20 70,16 80,14 90,11 100,9"
              />
              <circle v-for="p in trendDots" :key="p.x" :cx="p.x" :cy="p.y" r="0.9" class="fill-blue-500" />
            </svg>
            <p class="text-xs text-slate-500 dark:text-slate-400">MAU trend (example data)</p>
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 class="font-bold text-slate-900 dark:text-white">{{ t('admin.topNamespaces') }}</h3>
          <div class="mt-6 h-64">
            <div class="flex h-52 items-end gap-4">
              <div v-for="bar in usageBars" :key="bar.name" class="flex flex-1 flex-col items-center">
                <div class="w-full rounded-t-md bg-blue-600" :style="{ height: bar.height }" />
                <span class="mt-2 text-xs text-slate-600 dark:text-slate-400">{{ bar.name }}</span>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Request volume by namespace (example)</p>
          </div>
        </div>
      </div>

      <!-- Namespaces List -->
      <div>
        <h3 class="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          {{ t('admin.namespaceDetails') }}
        </h3>
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.namespace') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.users') }}</th>
                <th class="px-6 py-3 font-bold text-slate-900 dark:text-white">{{ t('admin.plan') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ns in namespaces"
                :key="ns"
                class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">
                  {{ ns }}
                </td>
                <td class="px-6 py-3 text-slate-600 dark:text-slate-400">—</td>
                <td class="px-6 py-3 text-slate-600 dark:text-slate-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import AdminHeader from '@/components/admin/AdminHeader.vue';

definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const { all: allNamespaces } = useNamespace();
const selectedPeriod = ref('month');

const periods = computed(() => [
  { label: t('admin.last7Days'), value: 'week' },
  { label: t('admin.last30Days'), value: 'month' },
  { label: t('admin.last90Days'), value: 'quarter' },
  { label: t('admin.lastYear'), value: 'year' }
]);

// Фейковые данные для визуализации
const mockNamespaces = [
  { id: '1', name: 'production', users: 45, plan: 'Pro', status: 'active' },
  { id: '2', name: 'staging', users: 12, plan: 'Developer', status: 'active' },
  { id: '3', name: 'testing', users: 8, plan: 'Free', status: 'active' }
];

const namespaces = computed(() => allNamespaces.value?.length ? allNamespaces.value : mockNamespaces);

const trendDots = [
  { x: 0, y: 31 },
  { x: 10, y: 28 },
  { x: 20, y: 29 },
  { x: 30, y: 24 },
  { x: 40, y: 26 },
  { x: 50, y: 18 },
  { x: 60, y: 20 },
  { x: 70, y: 16 },
  { x: 80, y: 14 },
  { x: 90, y: 11 },
  { x: 100, y: 9 }
];

const usageBars = [
  { name: 'prod', height: '85%' },
  { name: 'stage', height: '55%' },
  { name: 'test', height: '38%' },
  { name: 'dev', height: '24%' }
];
</script>

