<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { plansBarbershops, plansBeauty } from '@/utils/mockCatalog';
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

const { t } = useI18n();

// Single-vertical filtered view of the Catalog: lota Plans businesses only
// (booking/appointment-based services). Mock content only, same as
// pages/catalog.vue.
const categories = [
  { key: 'barbershop', icon: 'lucide:scissors', label: 'Барбершопы' },
  { key: 'nails', icon: 'lucide:sparkles', label: 'Маникюр' },
  { key: 'spa', icon: 'lucide:flower-2', label: 'Спа и массаж' },
  { key: 'beauty', icon: 'lucide:wand-2', label: 'Косметология' },
  { key: 'lashes', icon: 'lucide:eye', label: 'Ресницы и брови' },
] as const;
const activeCategory = ref('barbershop');

const favorites = ref<Set<string>>(new Set());
function toggleFavorite(key: string) {
  const next = new Set(favorites.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  favorites.value = next;
}

const sections = [
  { key: 'barbers', title: 'Стрижка и барбершопы', items: plansBarbershops },
  { key: 'beauty', title: 'Красота и уход', items: plansBeauty },
];

const siteUrl = 'https://lota.tools';
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

        <!-- Businesses, grouped by kind -->
        <div v-for="section in sections" :key="section.key">
          <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{{ section.title }}</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <BusinessCard
              v-for="biz in section.items"
              :key="biz.key"
              :business="biz"
              :is-favorite="favorites.has(biz.key)"
              @toggle-favorite="toggleFavorite"
            />
          </div>
        </div>

        <ReviewsSection />
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
