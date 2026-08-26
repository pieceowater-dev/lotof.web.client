<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { menuBusinesses, type MockBusiness, type MockReview } from '@/utils/mockCatalog';
import {
  getCatalogBusinesses,
  getCatalogCategories,
  getCatalogFavorites,
  toggleCatalogFavorite,
  getCatalogReviews,
  type CatalogCategory,
} from '@/api/hub/catalog';
import { toDisplayBusiness, dedupeByBrand } from '@/utils/mapCatalogBusiness';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { logError } from '@/utils/logger';
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

const { t } = useI18n();

const { token: patronToken, login: patronLogin } = usePatronAuth();

// Single-vertical filtered view of the Catalog: lota Menu businesses only
// (cafes, restaurants, delivery). Real taxonomy, real filtering -- deduped
// by brand (see utils/mapCatalogBusiness.ts's dedupeByBrand) so a tenant
// with several branches shows one card; the storefront itself handles
// branch selection once a Patron gets there.
const categories = ref<CatalogCategory[]>([]);
const activeCategoryId = ref<string | null>(null);

const realBusinesses = ref<MockBusiness[] | null>(null);
const reviews = ref<MockReview[]>([]);

async function loadBusinesses() {
  try {
    const [categoriesResp, businessesResp] = await Promise.all([
      getCatalogCategories(),
      getCatalogBusinesses({ categoryId: activeCategoryId.value, length: FilterPaginationLengthEnum.OneHundred }),
    ]);
    categories.value = categoriesResp;
    const deduped = dedupeByBrand(businessesResp.rows);
    realBusinesses.value = deduped.length > 0 ? deduped.map((b) => toDisplayBusiness(b, categoriesResp)) : null;

    // Bounded fan-out -- see pages/catalog.vue's loadCatalogFeed for why.
    const perBusiness = await Promise.all(
      deduped.slice(0, 10).map(async (b) => {
        try {
          const list = await getCatalogReviews(b.id);
          return list.map((r) => ({
            key: r.id,
            author: r.authorName,
            business: b.name,
            rating: r.rating,
            date: formatReviewDate(r.createdAt),
            text: r.body,
          }));
        } catch {
          return [];
        }
      }),
    );
    reviews.value = perBusiness.flat().slice(0, 6);
  } catch (e) {
    logError('[stores] failed to load real catalog businesses', e);
  }
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

onMounted(loadBusinesses);

function selectCategory(id: string | null) {
  activeCategoryId.value = id;
  loadBusinesses();
}

const displayedBusinesses = computed(() => realBusinesses.value ?? menuBusinesses);

const favoriteIds = ref<Set<string>>(new Set());
onMounted(async () => {
  if (!patronToken.value) return;
  try {
    favoriteIds.value = new Set(await getCatalogFavorites(patronToken.value));
  } catch (e) {
    logError('[stores] failed to load favorites', e);
  }
});

async function toggleFavorite(key: string) {
  if (!patronToken.value) {
    patronLogin();
    return;
  }
  const wasFavorite = favoriteIds.value.has(key);
  const next = new Set(favoriteIds.value);
  if (wasFavorite) next.delete(key);
  else next.add(key);
  favoriteIds.value = next;

  try {
    const nowFavorited = await toggleCatalogFavorite(patronToken.value, key);
    const reconciled = new Set(favoriteIds.value);
    if (nowFavorited) reconciled.add(key);
    else reconciled.delete(key);
    favoriteIds.value = reconciled;
  } catch (e) {
    logError('[stores] toggleFavorite failed', e);
    const rollback = new Set(favoriteIds.value);
    if (wasFavorite) rollback.add(key);
    else rollback.delete(key);
    favoriteIds.value = rollback;
  }
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
        <!-- Categories: real taxonomy, actually filters the grid below. -->
        <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="activeCategoryId === null
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="selectCategory(null)"
            >
              <UIcon name="lucide:layout-grid" class="w-4 h-4" />
              {{ t('home.allCategories') || 'Все' }}
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="activeCategoryId === cat.id
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="selectCategory(cat.id)"
            >
              <UIcon :name="cat.icon || 'lucide:store'" class="w-4 h-4" />
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- Businesses grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <BusinessCard
            v-for="biz in displayedBusinesses"
            :key="biz.key"
            :business="biz"
            :is-favorite="favoriteIds.has(biz.key)"
            @toggle-favorite="toggleFavorite"
          />
        </div>

        <ReviewsSection :reviews="reviews" />
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
