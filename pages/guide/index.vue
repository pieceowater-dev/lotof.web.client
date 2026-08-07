<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <NuxtLink
          to="/"
          class="mb-6 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <UIcon name="lucide:home" class="h-3.5 w-3.5" />
          {{ t('app.home') }}
        </NuxtLink>

        <div class="flex flex-col items-center text-center">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 ring-1 ring-primary-100 dark:bg-primary-900/20 dark:ring-primary-900/40">
            <UIcon name="lucide:life-buoy" class="h-7 w-7 text-primary" />
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">lota {{ t('guide.title') }}</h1>
          <p class="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            {{ t('guide.homeTagline') }}
          </p>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NuxtLink
          v-for="item in entries"
          :key="item.param"
          :to="`/guide/${item.param}`"
          class="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:translate-y-0 dark:border-gray-800 dark:bg-gray-900"
        >
          <span
            class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-colors group-hover:bg-primary-50 group-hover:text-primary dark:bg-gray-800 dark:text-gray-300 dark:group-hover:bg-primary-900/30"
          >
            <UIcon :name="item.icon" class="h-5 w-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="font-semibold text-gray-900 dark:text-white">{{ item.label }}</span>
              <UIcon name="lucide:arrow-up-right" class="h-3.5 w-3.5 text-gray-300 transition-colors group-hover:text-primary dark:text-gray-600" />
            </span>
            <span class="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{{ item.description }}</span>
          </span>
        </NuxtLink>
      </div>

      <div class="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <GuideContactBar variant="card" />
      </div>
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
    return {
      param: id,
      label: app ? t(app.titleKey) : id,
      description: app ? t(app.descriptionKey) : '',
      icon: app?.icon || 'lucide:layout-grid',
    };
  }),
  { param: guideAppToParam('LANDING'), label: t('guide.appLanding'), description: t('guide.landingDesc'), icon: 'lucide:home' },
  { param: guideAppToParam('GLOBAL'), label: t('guide.appGlobal'), description: t('guide.globalDesc'), icon: 'lucide:help-circle' },
]);
</script>
