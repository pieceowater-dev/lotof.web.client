<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { menuBusinesses, type MockBusiness, type MockReview } from '@/utils/mockCatalog';
import {
  getCatalogBusinesses,
  getCatalogCategories,
  getCatalogTags,
  getCatalogFavorites,
  toggleCatalogFavorite,
  getCatalogReviews,
  type CatalogTag,
} from '@/api/hub/catalog';
import { toDisplayBusiness, dedupeByBrand } from '@/utils/mapCatalogBusiness';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { logError } from '@/utils/logger';
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

const { t } = useI18n();

const { token: patronToken, login: patronLogin } = usePatronAuth();

// Single-vertical filtered view of the Catalog: lota Menu businesses only
// (cafes, restaurants, delivery). Real taxonomy (Tag, the aggregated
// per-tenant Menu category names -- not CatalogCategory, the fixed 5-row
// business-type list), real filtering -- deduped by brand (see
// utils/mapCatalogBusiness.ts's dedupeByBrand) so a tenant with several
// branches shows one card; the storefront itself handles branch selection
// once a Patron gets there.
const tags = ref<CatalogTag[]>([]);
const activeTagId = ref<string | null>(null);
const favoritesOnly = ref(false);

const realBusinesses = ref<MockBusiness[] | null>(null);
const reviews = ref<MockReview[]>([]);

const searchQuery = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadBusinesses, 350);
}

async function loadBusinesses() {
  try {
    const [categoriesResp, tagsResp, businessesResp] = await Promise.all([
      getCatalogCategories(),
      getCatalogTags(),
      getCatalogBusinesses({
        tagId: activeTagId.value,
        search: searchQuery.value.trim() || undefined,
        length: FilterPaginationLengthEnum.OneHundred,
      }),
    ]);
    tags.value = tagsResp;
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
            businessTo: `/to/${b.namespaceSlug}/menu`,
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

function selectTag(id: string | null) {
  activeTagId.value = id;
  loadBusinesses();
}

const displayedBusinesses = computed(() => {
  // No mock fallback while a search is active -- an intentional "nothing
  // matched" result should say so, not quietly show unrelated mock cards.
  const items = realBusinesses.value ?? (searchQuery.value.trim() ? [] : menuBusinesses);
  return favoritesOnly.value ? items.filter((b) => favoriteIds.value.has(b.key)) : items;
});

const favoriteIds = ref<Set<string>>(new Set());
onMounted(async () => {
  if (!patronToken.value) return;
  try {
    favoriteIds.value = new Set(await getCatalogFavorites(patronToken.value));
  } catch (e) {
    logError('[stores] failed to load favorites', e);
  }
});

function toggleFavoritesOnly() {
  if (!patronToken.value) {
    patronLogin();
    return;
  }
  favoritesOnly.value = !favoritesOnly.value;
}

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
        <!-- Categories: real per-tenant Menu category names, actually
             filters the grid below. "Избранное" is a separate quick filter
             (client-side, narrows to favorited businesses). -->
        <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="activeTagId === null && !favoritesOnly
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="favoritesOnly = false; selectTag(null)"
            >
              <UIcon name="lucide:layout-grid" class="w-4 h-4" />
              {{ t('home.allCategories') || 'Все' }}
            </button>
            <button
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="favoritesOnly
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="toggleFavoritesOnly"
            >
              <UIcon name="lucide:heart" class="w-4 h-4" :class="favoritesOnly && 'fill-white'" />
              {{ t('home.favoritesFilter') || 'Избранное' }}
            </button>
            <button
              v-for="tag in tags"
              :key="tag.id"
              type="button"
              class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
              :class="activeTagId === tag.id && !favoritesOnly
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
              @click="favoritesOnly = false; selectTag(tag.id)"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="relative">
          <UIcon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('home.searchBusinesses') || 'Поиск заведений'"
            class="w-full pl-9 pr-3 py-2 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            @input="onSearchInput"
          >
        </div>

        <!-- Businesses grid -->
        <p v-if="!displayedBusinesses.length" class="text-sm text-gray-400 py-10 text-center">
          {{ t('home.noSearchResults') || 'Ничего не найдено' }}
        </p>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
