<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const TABS = [
  { address: '', icon: 'lucide:calendar-days', labelKey: 'plans.calendar' },
  { address: 'catalog', icon: 'lucide:layout-grid', labelKey: 'plans.catalog' },
  { address: 'reports', icon: 'lucide:bar-chart-3', labelKey: 'plans.reports' },
] as const;

function tabPath(address: string) {
  return address ? `/${nsSlug.value}/plans/${address}` : `/${nsSlug.value}/plans`;
}
function isActive(address: string) {
  return route.path === tabPath(address);
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <div class="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-1">
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.address"
        :to="tabPath(tab.address)"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="isActive(tab.address)
          ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
      >
        <Icon :name="tab.icon" class="w-4 h-4 flex-shrink-0" />
        {{ t(tab.labelKey) }}
      </NuxtLink>
    </div>
    <div class="flex-1 min-w-[120px]"><slot name="search" /></div>
    <slot name="action" />
  </div>
</template>
