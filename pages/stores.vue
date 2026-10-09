<script setup lang="ts">
definePageMeta({ layout: 'full' });

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
import { maskProfanity } from '@/utils/profanityFilter';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { logError } from '@/utils/logger';
import CatalogHeader from '@/components/catalog/CatalogHeader.vue';
import CatalogSearch from '@/components/catalog/CatalogSearch.vue';
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
const activeTagId = ref<string | null>(null);
const favoritesOnly = ref(false);
const searchQuery = ref('');

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

// B1: useAsyncData (not onMounted) so the server renders the real catalog
// list instead of an empty shell -- same pattern as memberships.vue
// (a471e4c). Both the debounced search box and the immediate tag-select
// buttons need to trigger a refetch, so both call the returned
// `refresh()` below instead of a raw reload function. Favorites stay
// separate, further down, genuinely client-only (patron auth token).
const { data: catalogData, refresh: refreshBusinesses } = await useAsyncData(
  'stores-catalog',
  async () => {
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
      const tags = tagsResp.map((tg) => ({ ...tg, name: maskProfanity(tg.name) }));
      // lota Menu venues only — lota Contacts membership pages live on /memberships.
      const deduped = dedupeByBrand(businessesResp.rows).filter(
        (b) => ((b as { source?: string }).source || 'MENU') !== 'CONTACTS',
      );
      const realBusinesses = deduped.length > 0 ? deduped.map((b) => toDisplayBusiness(b, categoriesResp)) : null;

      // Bounded fan-out -- see pages/catalog.vue's loadCatalogFeed for why.
      const perBusiness = await Promise.all(
        deduped.slice(0, 10).map(async (b) => {
          try {
            const list = await getCatalogReviews(b.id);
            return list.map((r) => ({
              key: r.id,
              author: maskProfanity(r.authorName),
              business: maskProfanity(b.name),
              businessTo: `/to/${b.namespaceSlug}/menu`,
              rating: r.rating,
              date: formatReviewDate(r.createdAt),
              text: maskProfanity(r.body),
            }));
          } catch {
            return [];
          }
        }),
      );
      const reviews = perBusiness.flat().slice(0, 6);
      return { tags, realBusinesses, reviews };
    } catch (e) {
      logError('[stores] failed to load real catalog businesses', e);
      return { tags: [] as CatalogTag[], realBusinesses: null as MockBusiness[] | null, reviews: [] as MockReview[] };
    }
  },
);
const tags = computed(() => catalogData.value?.tags ?? []);
const realBusinesses = computed(() => catalogData.value?.realBusinesses ?? null);
const reviews = computed(() => catalogData.value?.reviews ?? []);

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => refreshBusinesses(), 350);
}

function selectTag(id: string | null) {
  activeTagId.value = id;
  refreshBusinesses();
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

const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: () => `${t('home.storesTitle') || 'Заведения'} — lota`,
  description: () => t('home.storesSubtitle') || 'Кафе, рестораны и доставка на lota Menu',
  ogType: 'website',
  ogUrl: `${siteUrl}/stores`,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 pb-16 pt-6 md:pt-10">
    <div class="flex flex-col">
      <CatalogHeader back :title="t('home.storesTitle') || 'Заведения'" :subtitle="t('home.storesSubtitle') || 'Кафе, рестораны и доставка на lota Menu'" />

      <div class="flex flex-col gap-8">
        <!-- Categories: real per-tenant Menu category names, actually
             filters the grid below. "Избранное" is a separate quick filter
             (client-side, narrows to favorited businesses). -->
        <div class="overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
          <div class="flex gap-2">
            <button
              type="button"
              class="pill-filter"
              :class="activeTagId === null && !favoritesOnly
                ? 'pill-filter--active'
                : ''"
              @click="favoritesOnly = false; selectTag(null)"
            >
              <UIcon
                name="lucide:layout-grid"
                class="w-4 h-4"
              />
              {{ t('home.allCategories') || 'Все' }}
            </button>
            <button
              type="button"
              class="pill-filter"
              :class="favoritesOnly
                ? 'pill-filter--rose'
                : ''"
              @click="toggleFavoritesOnly"
            >
              <UIcon
                name="lucide:heart"
                class="w-4 h-4"
                :class="favoritesOnly && 'fill-white'"
              />
              {{ t('home.favoritesFilter') || 'Избранное' }}
            </button>
            <button
              v-for="tag in tags"
              :key="tag.id"
              type="button"
              class="pill-filter"
              :class="activeTagId === tag.id && !favoritesOnly
                ? 'pill-filter--active'
                : ''"
              @click="favoritesOnly = false; selectTag(tag.id)"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>

        <!-- Search -->
        <CatalogSearch v-model="searchQuery" :placeholder="t('home.searchBusinesses') || 'Поиск заведений'" class="" @input="onSearchInput" />
        <!-- Businesses grid -->
        <p
          v-if="!displayedBusinesses.length"
          class="text-sm text-gray-400 py-10 text-center"
        >
          {{ t('home.noSearchResults') || 'Ничего не найдено' }}
        </p>
        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
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

