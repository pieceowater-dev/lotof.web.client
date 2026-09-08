<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';

const { t } = useI18n();
const route = useRoute();
const { isOwnerOrManager } = usePlansStaffRole();
const nsSlug = computed(() => route.params.namespace as string);

const TABS = [
  { address: '', icon: 'lucide:calendar-days', labelKey: 'plans.calendar' },
  { address: 'catalog', icon: 'lucide:list', labelKey: 'plans.catalog' },
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
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-1.5 flex-wrap">
      <div class="flex-1 min-w-[160px]"><slot name="search" /></div>
      <div class="flex items-center gap-1.5">
        <slot name="action" />
        <NuxtLink
          v-if="isOwnerOrManager"
          :to="`/${nsSlug}/plans/settings`"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        >
          <Icon name="lucide:settings" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ t('plans.settings') }}</span>
        </NuxtLink>
      </div>
    </div>

    <div class="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
      <NuxtLink
        v-for="tab in TABS"
        :key="tab.address"
        :to="tabPath(tab.address)"
        class="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors"
        :class="isActive(tab.address)
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
      >
        <Icon :name="tab.icon" class="w-4 h-4 flex-shrink-0" />
        {{ t(tab.labelKey) }}
      </NuxtLink>
    </div>
  </div>
</template>
