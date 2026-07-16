<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import StaffSection from '@/components/menu/settings/StaffSection.vue';
import BrandSection from '@/components/menu/settings/BrandSection.vue';
import BranchesSection from '@/components/menu/settings/BranchesSection.vue';
import CatalogSection from '@/components/menu/settings/CatalogSection.vue';
import PromoBannersSection from '@/components/menu/settings/PromoBannersSection.vue';
import ShareLinkSection from '@/components/menu/settings/ShareLinkSection.vue';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const goBack = () => {
  if (process.client) {
    window.history.back();
    return;
  }
  navigateTo(`/${nsSlug.value}/menu`);
};

type TabKey = 'staff' | 'brand' | 'branches' | 'catalog' | 'promobanners' | 'share';

const tabs = computed(() => [
  { key: 'staff' as TabKey, label: t('menu.staff') || 'Staff', icon: 'lucide:users' },
  { key: 'brand' as TabKey, label: t('menu.brand') || 'Brand', icon: 'lucide:palette' },
  { key: 'branches' as TabKey, label: t('menu.branches') || 'Branches', icon: 'lucide:map-pin' },
  { key: 'catalog' as TabKey, label: t('menu.catalog') || 'Catalog', icon: 'lucide:layout-grid' },
  { key: 'promobanners' as TabKey, label: t('menu.promoBanners') || 'Banners', icon: 'lucide:image' },
  { key: 'share' as TabKey, label: t('menu.shareTab') || 'Share', icon: 'lucide:link' },
]);

const activeTab = ref<TabKey>((route.query.tab as TabKey) || 'staff');

watch(activeTab, (tab) => {
  navigateTo({ query: { ...route.query, tab } }, { replace: true });
});
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">
          {{ t('menu.settings') || 'Settings' }}
        </h1>
      </div>
      <div class="flex flex-row flex-wrap justify-between items-center gap-2 w-full md:w-auto">
        <UButton
          icon="lucide:star"
          size="xs"
          color="amber"
          variant="soft"
          class="min-w-fit whitespace-nowrap"
          :to="`/${nsSlug}/menu/plans?manage=1`"
        >
          {{ t('menu.upgradePlan') || 'Upgrade plan' }}
        </UButton>
        <UButton
          icon="lucide:arrow-left"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit whitespace-nowrap gap-2"
          @click="goBack"
        >
          {{ t('app.back') || 'Back' }}
        </UButton>
      </div>
    </div>

    <div class="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800 mb-4 flex-shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === tab.key
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        @click="activeTab = tab.key"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <StaffSection v-if="activeTab === 'staff'" />
      <BrandSection v-else-if="activeTab === 'brand'" />
      <BranchesSection v-else-if="activeTab === 'branches'" />
      <CatalogSection v-else-if="activeTab === 'catalog'" />
      <PromoBannersSection v-else-if="activeTab === 'promobanners'" />
      <ShareLinkSection v-else-if="activeTab === 'share'" />
    </div>
  </div>
</template>
