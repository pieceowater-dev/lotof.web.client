<template>
  <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
    <NuxtLink
      to="/"
      class="mb-6 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      <UIcon name="lucide:home" class="h-3.5 w-3.5" />
      {{ t('app.home') }}
    </NuxtLink>

    <div class="mb-10 flex items-center gap-2">
      <UIcon name="lucide:life-buoy" class="h-6 w-6 text-primary" />
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">lota {{ t('guide.title') }}</h1>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <NuxtLink
        v-for="item in entries"
        :key="item.param"
        :to="`/guide/${item.param}`"
        class="flex items-center justify-between rounded-xl border border-gray-200 px-5 py-4 transition-colors hover:border-primary hover:bg-primary-50/50 dark:border-gray-800 dark:hover:bg-primary-900/10"
      >
        <span class="flex items-center gap-3">
          <UIcon :name="item.icon" class="h-5 w-5 text-primary" />
          <span class="font-medium text-gray-900 dark:text-white">{{ item.label }}</span>
        </span>
        <UIcon name="lucide:arrow-up-right" class="h-4 w-4 text-gray-400" />
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS } from '@/config/apps';
import { GUIDE_APP_IDS, guideAppToParam } from '@/composables/useGuideContext';

useHead({ title: 'lota Гид' });
const { t } = useI18n();

const entries = computed(() => [
  ...GUIDE_APP_IDS.map((id) => {
    const app = ALL_APPS.find((a) => a.address === id);
    return { param: id, label: app ? t(app.titleKey) : id, icon: app?.icon || 'lucide:layout-grid' };
  }),
  { param: guideAppToParam('LANDING'), label: t('guide.appLanding'), icon: 'lucide:home' },
  { param: guideAppToParam('GLOBAL'), label: t('guide.appGlobal'), icon: 'lucide:help-circle' },
]);
</script>
