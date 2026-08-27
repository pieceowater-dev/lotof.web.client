<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

// Single-vertical filtered view of the Catalog: lota Plans businesses only
// (booking/appointment-based services). Unlike /catalog and /stores, this
// page has no real data source at all yet -- lota Plans isn't aggregated
// into lotof.hub.msvc.core (see that repo's BusinessSource.PLANS, reserved
// but unused). A genuine empty state, not fabricated mock businesses,
// since real ones now appear next to this on /catalog and /stores.
const categories = [
  { key: 'barbershop', icon: 'lucide:scissors', label: 'Барбершопы' },
  { key: 'nails', icon: 'lucide:sparkles', label: 'Маникюр' },
  { key: 'spa', icon: 'lucide:flower-2', label: 'Спа и массаж' },
  { key: 'beauty', icon: 'lucide:wand-2', label: 'Косметология' },
  { key: 'lashes', icon: 'lucide:eye', label: 'Ресницы и брови' },
] as const;
const activeCategory = ref('barbershop');

const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: () => `${t('home.servicesTitle') || 'Услуги'} — lota`,
  description: () => t('home.servicesSubtitle') || 'Запись и бронирование на lota Plans',
  ogType: 'website',
  ogUrl: `${siteUrl}/services`,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10 md:py-16">
    <div class="flex flex-col gap-6">
      <NuxtLink
        to="/catalog"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-fit"
      >
        <UIcon name="lucide:arrow-left" class="w-4 h-4" />
        {{ t('home.backToCatalog') || 'Каталог' }}
      </NuxtLink>

      <div>
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{{ t('home.servicesTitle') || 'Услуги' }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ t('home.servicesSubtitle') || 'Запись и бронирование на lota Plans' }}</p>
      </div>

      <div class="flex flex-col gap-8">
        <!-- Categories -->
        <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
          <div class="flex gap-2">
            <button
              v-for="cat in categories"
              :key="cat.key"
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="activeCategory === cat.key
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="activeCategory = cat.key"
            >
              <UIcon :name="cat.icon" class="w-4 h-4" />
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- No real lota Plans aggregation yet -- see script comment above. -->
        <div class="rounded-3xl p-8 md:p-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center text-center gap-3">
          <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
            <UIcon name="lucide:scissors" class="w-7 h-7 text-violet-500" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ t('home.servicesComingSoonTitle') || 'Скоро здесь появятся заведения' }}
          </h3>
          <p class="max-w-md text-sm text-gray-500 dark:text-gray-400">
            {{ t('home.servicesComingSoonSubtitle') || 'lota Plans пока не подключена к каталогу — запись и бронирование появятся здесь позже.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
