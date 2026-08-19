<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsStaffRole } from '@/composables/useGoodsStaffRole';

const { t } = useI18n();
const route = useRoute();
const { canManageStock, isOwnerOrManager } = useGoodsStaffRole();
const nsSlug = computed(() => route.params.namespace as string);

// Real navigation between real pages (not local tab state) -- styled as a
// tab bar so moving between the warehouse's sub-sections feels like one
// app instead of a pile of standalone pages, but the URL always reflects
// which "tab" is open.
const TABS = [
  { address: '', icon: 'lucide:warehouse', labelKey: 'goods.warehouse' },
  { address: 'catalog', icon: 'lucide:list', labelKey: 'goods.catalog' },
  { address: 'movements', icon: 'lucide:arrow-left-right', labelKey: 'goods.movements' },
  { address: 'inventory', icon: 'lucide:clipboard-check', labelKey: 'goods.inventory' },
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
  <div v-if="canManageStock" class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
    <div class="flex items-center gap-1 overflow-x-auto">
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

    <!-- Settings/Register used to only be reachable from index.vue's header
         -- every other page in the module was a dead end for them. Putting
         them here (rendered on every page via this shared component) closes
         that gap without duplicating header markup across 6 files. Register
         gets real button weight (it's the one-click "go sell something"
         escape hatch from anywhere in the back-office); Settings stays a
         quiet icon link since it's an occasional, admin-only destination. -->
    <div class="flex items-center gap-1.5 ml-auto flex-shrink-0 pl-2">
      <UButton :to="`/${nsSlug}/goods/register`" color="primary" variant="soft" size="xs" icon="lucide:store" class="flex-shrink-0">
        <span class="hidden sm:inline">{{ t('goods.register') }}</span>
      </UButton>
      <NuxtLink
        v-if="isOwnerOrManager"
        data-tour="goods-settings-btn"
        :to="`/${nsSlug}/goods/settings`"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <Icon name="lucide:settings" class="w-4 h-4" />
        <span class="hidden sm:inline">{{ t('goods.settings') }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
