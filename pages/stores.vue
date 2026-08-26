<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { menuBusinesses, type MockBusiness } from '@/utils/mockCatalog';
import { getCatalogBusinesses, getCatalogCategories } from '@/api/hub/catalog';
import { toDisplayBusiness } from '@/utils/mapCatalogBusiness';
import { logError } from '@/utils/logger';
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

const { t } = useI18n();

// Single-vertical filtered view of the Catalog: lota Menu businesses only
// (cafes, restaurants, delivery). Category chips below are still decorative
// (they're finer-grained "genres" than the seeded Category taxonomy, no 1:1
// mapping) -- only the businesses grid itself is real, fetched from
// lotof.hub.msvc.core's cross-tenant aggregator. Falls back to the mock
// grid while that aggregator has no real businesses synced yet, so the page
// never looks broken/empty.
const categories = [
  { key: 'cafe', icon: 'lucide:coffee', label: 'Кафе' },
  { key: 'restaurant', icon: 'lucide:utensils', label: 'Рестораны' },
  { key: 'delivery', icon: 'lucide:bike', label: 'Доставка' },
  { key: 'fastfood', icon: 'lucide:pizza', label: 'Фастфуд' },
  { key: 'bakery', icon: 'lucide:croissant', label: 'Выпечка' },
] as const;
const activeCategory = ref('cafe');

const realBusinesses = ref<MockBusiness[] | null>(null);
onMounted(async () => {
  try {
    const [categoriesResp, businessesResp] = await Promise.all([getCatalogCategories(), getCatalogBusinesses()]);
    if (businessesResp.rows.length > 0) {
      realBusinesses.value = businessesResp.rows.map((b) => toDisplayBusiness(b, categoriesResp));
    }
  } catch (e) {
    logError('[stores] failed to load real catalog businesses', e);
  }
});
const displayedBusinesses = computed(() => realBusinesses.value ?? menuBusinesses);

const favorites = ref<Set<string>>(new Set());
function toggleFavorite(key: string) {
  const next = new Set(favorites.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  favorites.value = next;
}

const siteUrl = 'https://lota.tools';
useSeoMeta({
  title: () => `${t('home.storesTitle') || 'Заведения'} — lota`,
  description: () => t('home.storesSubtitle') || 'Кафе, рестораны и доставка на lota Menu',
  ogType: 'website',
  ogUrl: `${siteUrl}/stores`,
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
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{{ t('home.storesTitle') || 'Заведения' }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ t('home.storesSubtitle') || 'Кафе, рестораны и доставка на lota Menu' }}</p>
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

        <!-- Businesses grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <BusinessCard
            v-for="biz in displayedBusinesses"
            :key="biz.key"
            :business="biz"
            :is-favorite="favorites.has(biz.key)"
            @toggle-favorite="toggleFavorite"
          />
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
