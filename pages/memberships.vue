<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePatronAuth } from '@/composables/usePatronAuth';
import { resolveSiteUrl } from '@/utils/siteUrl';
import type { MockBusiness, MockReview } from '@/utils/mockCatalog';
import {
  getCatalogBusinesses,
  getCatalogCategories,
  getCatalogFavorites,
  toggleCatalogFavorite,
  getCatalogReviews,
} from '@/api/hub/catalog';
import { toDisplayBusiness, dedupeByBrand } from '@/utils/mapCatalogBusiness';
import { maskProfanity } from '@/utils/profanityFilter';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { logError } from '@/utils/logger';
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

// Single-vertical view of the Catalog: lota Contacts membership pages only
// (gyms, studios, pools). A full analog of pages/stores.vue — deliberately
// separate from lota Menu storefronts, never mixed.
const { t } = useI18n();
const { token: patronToken, login: patronLogin } = usePatronAuth();

const isMembership = (b: { source?: string }) => (b.source || 'MENU') === 'CONTACTS';

const realBusinesses = ref<MockBusiness[] | null>(null);
const reviews = ref<MockReview[]>([]);
const favoritesOnly = ref(false);

const searchQuery = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadBusinesses, 350);
}

async function loadBusinesses() {
  try {
    const [categoriesResp, businessesResp] = await Promise.all([
      getCatalogCategories(),
      getCatalogBusinesses({
        search: searchQuery.value.trim() || undefined,
        length: FilterPaginationLengthEnum.OneHundred,
      }),
    ]);
    const deduped = dedupeByBrand(businessesResp.rows).filter(isMembership);
    realBusinesses.value = deduped.length > 0 ? deduped.map((b) => toDisplayBusiness(b, categoriesResp)) : null;

    const perBusiness = await Promise.all(
      deduped.slice(0, 10).map(async (b) => {
        try {
          const list = await getCatalogReviews(b.id);
          return list.map((r) => ({
            key: r.id,
            author: maskProfanity(r.authorName),
            business: maskProfanity(b.name),
            businessTo: `/to/${b.namespaceSlug}/memberships`,
            rating: r.rating,
            date: formatReviewDate(r.createdAt),
            text: maskProfanity(r.body),
          }));
        } catch {
          return [];
        }
      }),
    );
    reviews.value = perBusiness.flat().slice(0, 6);
  } catch (e) {
    logError('[memberships] failed to load catalog businesses', e);
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

const displayedBusinesses = computed(() => {
  const items = realBusinesses.value ?? [];
  return favoritesOnly.value ? items.filter((b) => favoriteIds.value.has(b.key)) : items;
});

const favoriteIds = ref<Set<string>>(new Set());
onMounted(async () => {
  if (!patronToken.value) return;
  try {
    favoriteIds.value = new Set(await getCatalogFavorites(patronToken.value));
  } catch (e) {
    logError('[memberships] failed to load favorites', e);
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
    logError('[memberships] toggleFavorite failed', e);
    const rollback = new Set(favoriteIds.value);
    if (wasFavorite) rollback.add(key);
    else rollback.delete(key);
    favoriteIds.value = rollback;
  }
}

const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: () => `${t('membership.nav') || 'Абонементы'} — lota`,
  description: () => t('home.membershipsSubtitle') || 'Абонементы в залы, студии и бассейны',
  ogType: 'website',
  ogUrl: `${siteUrl}/memberships`,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10 md:py-16">
    <div class="flex flex-col gap-6">
      <NuxtLink
        to="/catalog"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-fit"
      >
        <UIcon
          name="lucide:arrow-left"
          class="w-4 h-4"
        />
        {{ t('home.backToCatalog') || 'Каталог' }}
      </NuxtLink>

      <div>
        <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {{ t('membership.nav') || 'Абонементы' }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {{ t('home.membershipsSubtitle') || 'Абонементы в залы, студии и бассейны' }}
        </p>
      </div>

      <div class="flex flex-col gap-8">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-colors"
            :class="!favoritesOnly
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'"
            @click="favoritesOnly = false"
          >
            <UIcon
              name="lucide:layout-grid"
              class="w-4 h-4"
            />
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
            <UIcon
              name="lucide:heart"
              class="w-4 h-4"
              :class="favoritesOnly && 'fill-white'"
            />
            {{ t('home.favoritesFilter') || 'Избранное' }}
          </button>
        </div>

        <div class="relative">
          <UIcon
            name="lucide:search"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('home.searchBusinesses') || 'Поиск заведений'"
            class="w-full pl-9 pr-3 py-2 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            @input="onSearchInput"
          >
        </div>

        <p
          v-if="!displayedBusinesses.length"
          class="text-sm text-gray-400 py-10 text-center"
        >
          {{ t('home.membershipsEmpty') || 'Пока нет заведений с абонементами' }}
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
