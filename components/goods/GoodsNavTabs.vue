<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';

const { t } = useI18n();
const route = useRoute();
const { canManageStock } = useGoodsStaffRole();
const nsSlug = computed(() => route.params.namespace as string);

// Real navigation between real pages (not local tab state) -- styled as a
// tab bar so moving between the warehouse's sub-sections feels like one
// app instead of a pile of standalone pages, but the URL always reflects
// which "tab" is open.
const TABS = [
  { address: '', icon: 'lucide:warehouse', labelKey: 'goods.warehouse' },
  { address: 'catalog', icon: 'lucide:list', labelKey: 'goods.catalog' },
  { address: 'purchases', icon: 'lucide:shopping-cart', labelKey: 'goods.purchases' },
  { address: 'receiving', icon: 'lucide:package-check', labelKey: 'goods.receiving' },
  { address: 'transfers', icon: 'lucide:arrow-left-right', labelKey: 'goods.transfers' },
  { address: 'inventory', icon: 'lucide:clipboard-check', labelKey: 'goods.inventory' },
  { address: 'writeoffs', icon: 'lucide:trash-2', labelKey: 'goods.writeoffs' },
  { address: 'suppliers', icon: 'lucide:truck', labelKey: 'goods.suppliers' },
  { address: 'reports', icon: 'lucide:bar-chart-3', labelKey: 'goods.reports' },
] as const;

function tabPath(address: string) {
  return address ? `/${nsSlug.value}/goods/${address}` : `/${nsSlug.value}/goods`;
}
function isActive(address: string) {
  return route.path === tabPath(address);
}
</script>

<template>
  <div v-if="canManageStock" class="flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
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
</template>
