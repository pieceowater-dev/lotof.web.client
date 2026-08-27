<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getApiBasePath } from '@/utils/api-base';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';
import { plansBarbershops, plansBeauty, type MockBusiness, type MockReview } from '@/utils/mockCatalog';
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
import BusinessCard from '@/components/catalog/BusinessCard.vue';
import ReviewsSection from '@/components/catalog/ReviewsSection.vue';

const { t } = useI18n();

// Presence-only checks -- this page's whole layout is decided by which
// cookies exist, not by whether the corresponding identity has finished
// loading (fetchUser()/fetchMe() are for what those identities show, not
// for which branch of the page renders).
const { token: hubToken, login: hubLogin } = useAuth();
const { token: patronToken, fetchMe: fetchPatronMe, login: patronLogin } = usePatronAuth();

const hasHubToken = computed(() => !!hubToken.value);
const hasPatronToken = computed(() => !!patronToken.value);

// A hub-authenticated visitor (a business owner) is still welcome here --
// they never had to pick "just one" identity. Rather than make them go
// through a second Google consent screen to browse the Catalog as
// themselves, silently mint them a Patron using their already-verified hub
// email (see hub.gtw's AutoProvisionPatron).
async function autoProvisionPatron() {
  if (!hasHubToken.value || hasPatronToken.value) return;
  try {
    await $fetch(`${getApiBasePath('hub')}/google/patron/auto-provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hubToken.value}` },
    });
    refreshCookie(CookieKeys.PATRON_TOKEN);
    if (patronToken.value) await fetchPatronMe();
  } catch (e) {
    logError('[catalog] silent patron auto-provision failed', e);
  }
}

onMounted(() => {
  if (patronToken.value) {
    fetchPatronMe();
  } else if (hubToken.value) {
    autoProvisionPatron();
  }
});

const promoBanners = [
  {
    key: 'booking',
    icon: 'lucide:calendar-check',
    title: 'Запись без звонков',
    subtitle: 'Бронируйте у любимых заведений онлайн',
    gradient: 'from-violet-100 to-fuchsia-50',
    iconColor: 'text-violet-500',
    titleColor: 'text-violet-950',
    subtitleColor: 'text-violet-800',
  },
  {
    key: 'delivery',
    icon: 'lucide:bike',
    title: 'Быстрая доставка',
    subtitle: 'Меню рядом с вами уже готово к заказу',
    gradient: 'from-lime-100 to-yellow-50',
    iconColor: 'text-lime-600',
    titleColor: 'text-lime-950',
    subtitleColor: 'text-lime-800',
  },
  {
    key: 'onePlace',
    icon: 'lucide:layout-grid',
    title: 'Всё в одном месте',
    subtitle: 'Кафе, рестораны и услуги — в одном каталоге',
    gradient: 'from-blue-100 to-cyan-50',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-950',
    subtitleColor: 'text-blue-800',
  },
  {
    key: 'noApp',
    icon: 'lucide:smartphone',
    title: 'Без установки приложений',
    subtitle: 'Открывайте витрину заведения прямо в браузере',
    gradient: 'from-rose-100 to-pink-50',
    iconColor: 'text-rose-500',
    titleColor: 'text-rose-950',
    subtitleColor: 'text-rose-800',
  },
] as const;

// Auto-rotating, one-at-a-time -- see pages/index.vue's hero carousel for
// the same pattern (no mode="out-in" so old/new slides crossfade instead of
// leaving a gap where neither is mounted).
const activeBannerSlide = ref(0);
let bannerSlideTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  bannerSlideTimer = setInterval(() => {
    activeBannerSlide.value = (activeBannerSlide.value + 1) % promoBanners.length;
  }, 4500);
});
onBeforeUnmount(() => {
  if (bannerSlideTimer) clearInterval(bannerSlideTimer);
});

// -- Tags: the real, aggregated per-tenant Menu category taxonomy -- see
// utils/mapCatalogBusiness.ts's doc comments and hub.gtw's catalog.graphqls
// for why this is CatalogTag, not CatalogCategory (the fixed 5-row
// business-type list). Actually filters the grid below.
const tags = ref<CatalogTag[]>([]);
const activeTagId = ref<string | null>(null);
// "Избранное" is a separate, client-side quick filter (not a server tagId)
// -- narrows whatever's already loaded down to favorited businesses.
const favoritesOnly = ref(false);

// -- Businesses: real data, deduped by brand, capped at 10 for this
// homepage highlight row (see pages/stores.vue for the full, uncapped
// list -- that's what "Все" links to). No rating-based sort yet: nothing
// aggregates a per-business average from Review rows, so "top 10" is
// currently "first 10 after dedup" rather than genuinely rating-sorted --
// revisit once that aggregation exists.
const realBusinesses = ref<MockBusiness[] | null>(null);
const favoriteIds = ref<Set<string>>(new Set());
const reviews = ref<MockReview[]>([]);

const searchQuery = ref('');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadCatalogFeed, 350);
}

async function loadCatalogFeed() {
  try {
    const [categoriesResp, tagsResp, businessesResp] = await Promise.all([
      getCatalogCategories(),
      getCatalogTags(),
      getCatalogBusinesses({
        tagId: activeTagId.value,
        search: searchQuery.value.trim() || undefined,
        length: FilterPaginationLengthEnum.Fifty,
      }),
    ]);
    tags.value = tagsResp.map((tg) => ({ ...tg, name: maskProfanity(tg.name) }));
    const deduped = dedupeByBrand(businessesResp.rows).slice(0, 10);
    if (deduped.length > 0) {
      realBusinesses.value = deduped.map((b) => toDisplayBusiness(b, categoriesResp));

      // Bounded fan-out (at most 10 businesses) -- no bulk "reviews for many
      // businesses" query exists, and this list is already capped, so a
      // handful of small requests is fine. Concatenated and capped again so
      // the reviews grid doesn't grow unbounded either.
      const perBusiness = await Promise.all(
        deduped.map(async (b) => {
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
      reviews.value = perBusiness.flat().slice(0, 6);
    } else {
      realBusinesses.value = null;
      reviews.value = [];
    }
  } catch (e) {
    logError('[catalog] failed to load real catalog businesses', e);
  }
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

onMounted(loadCatalogFeed);

function selectTag(id: string | null) {
  activeTagId.value = id;
  loadCatalogFeed();
}

onMounted(async () => {
  if (!patronToken.value) return;
  try {
    favoriteIds.value = new Set(await getCatalogFavorites(patronToken.value));
  } catch (e) {
    logError('[catalog] failed to load favorites', e);
  }
});

function toggleFavoritesOnly() {
  if (!patronToken.value) {
    patronLogin();
    return;
  }
  favoritesOnly.value = !favoritesOnly.value;
}

const realBusinessesFiltered = computed(() => {
  const items = realBusinesses.value ?? [];
  return favoritesOnly.value ? items.filter((b) => favoriteIds.value.has(b.key)) : items;
});

// Mixed feed: the real "Заведения на lota" row, plus lota Plans placeholders
// (barbershops/beauty) -- see pages/services.vue for why those stay mock.
// The favorites-only filter only narrows the real row -- the Plans
// placeholders have no real favorite state to filter by.
const businessSections = computed(() => [
  { key: 'popular', title: 'Заведения на lota', to: '/stores', items: realBusinessesFiltered.value },
  { key: 'barbers', title: 'Стрижка и барбершопы', to: '/services', items: favoritesOnly.value ? [] : plansBarbershops },
  { key: 'beauty', title: 'Красота и уход', to: '/services', items: favoritesOnly.value ? [] : plansBeauty },
]);

async function toggleFavorite(key: string) {
  if (!patronToken.value) {
    patronLogin();
    return;
  }
  const wasFavorite = favoriteIds.value.has(key);
  // Optimistic: flip immediately, reconcile with the server's actual state
  // once the mutation resolves (never trust the optimistic guess as final).
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
    logError('[catalog] toggleFavorite failed', e);
    // Roll back on failure.
    const rollback = new Set(favoriteIds.value);
    if (wasFavorite) rollback.add(key);
    else rollback.delete(key);
    favoriteIds.value = rollback;
  }
}

const siteUrl = resolveSiteUrl(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: () => t('home.title') || 'Каталог lota',
  description: () => t('home.seoDescription') || 'Заказы, карты лояльности и заведения на платформе lota — для клиентов бизнесов.',
  ogTitle: () => t('home.title') || 'Каталог lota',
  ogDescription: () => t('home.seoDescription') || 'Заказы, карты лояльности и заведения на платформе lota — для клиентов бизнесов.',
  ogType: 'website',
  ogUrl: `${siteUrl}/catalog`,
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-10 md:py-16">
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-8">
        <!-- Promo banners: auto-rotating carousel on mobile (one slide at a
             time -- plenty of banners, not much width to show them side by
             side); a plain scrollable strip on tablet/desktop instead,
             where there's room to just show them all. -->
        <div class="relative h-32 rounded-3xl sm:hidden">
          <Transition name="banner-fade">
            <div
              :key="promoBanners[activeBannerSlide].key"
              class="absolute inset-0 rounded-3xl p-5 bg-gradient-to-br overflow-hidden"
              :class="promoBanners[activeBannerSlide].gradient"
            >
              <UIcon
                :name="promoBanners[activeBannerSlide].icon"
                class="absolute -right-3 -bottom-3 w-24 h-24 opacity-25"
                :class="promoBanners[activeBannerSlide].iconColor"
              />
              <h3 class="relative text-base font-bold leading-tight max-w-[75%]" :class="promoBanners[activeBannerSlide].titleColor">
                {{ promoBanners[activeBannerSlide].title }}
              </h3>
              <p class="relative mt-1.5 text-xs leading-snug max-w-[75%]" :class="promoBanners[activeBannerSlide].subtitleColor">
                {{ promoBanners[activeBannerSlide].subtitle }}
              </p>
            </div>
          </Transition>
          <div class="absolute bottom-3 right-4 flex items-center gap-1.5">
            <button
              v-for="(banner, i) in promoBanners"
              :key="banner.key"
              type="button"
              class="h-1.5 rounded-full transition-all"
              :class="i === activeBannerSlide ? 'w-5 bg-gray-900/40 dark:bg-white/50' : 'w-1.5 bg-gray-900/15 dark:bg-white/25'"
              :aria-label="banner.title"
              @click="activeBannerSlide = i"
            />
          </div>
        </div>

        <div class="hidden sm:block overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
          <div class="flex gap-4">
            <div
              v-for="banner in promoBanners"
              :key="banner.key"
              class="relative flex-shrink-0 w-[260px] md:w-[300px] h-32 rounded-3xl p-5 bg-gradient-to-br overflow-hidden"
              :class="banner.gradient"
            >
              <UIcon :name="banner.icon" class="absolute -right-3 -bottom-3 w-24 h-24 opacity-25" :class="banner.iconColor" />
              <h3 class="relative text-base font-bold leading-tight" :class="banner.titleColor">{{ banner.title }}</h3>
              <p class="relative mt-1.5 text-xs leading-snug" :class="banner.subtitleColor">{{ banner.subtitle }}</p>
            </div>
          </div>
        </div>

        <!-- Browse by vertical: the Catalog is the mixed "2-in-1" feed --
             these link out to the single-vertical filtered views. -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NuxtLink
            to="/stores"
            class="rounded-2xl p-4 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
          >
            <span class="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <UIcon name="lucide:utensils" class="w-5 h-5 text-orange-500" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('home.storesTitle') || 'Заведения' }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">{{ t('home.browseStoresCta') || 'Кафе и рестораны на lota Menu' }}</span>
            </span>
            <UIcon name="lucide:chevron-right" class="w-4 h-4 flex-shrink-0 ml-auto text-gray-300 dark:text-gray-600" />
          </NuxtLink>
          <NuxtLink
            to="/services"
            class="rounded-2xl p-4 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
          >
            <span class="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <UIcon name="lucide:scissors" class="w-5 h-5 text-violet-500" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('home.servicesTitle') || 'Услуги' }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">{{ t('home.browseServicesCta') || 'Запись и бронирование на lota Plans' }}</span>
            </span>
            <UIcon name="lucide:chevron-right" class="w-4 h-4 flex-shrink-0 ml-auto text-gray-300 dark:text-gray-600" />
          </NuxtLink>
        </div>

        <!-- Categories: real per-tenant Menu category names, aggregated and
             normalized -- actually filters the grid below. "Избранное" is a
             separate quick filter (client-side, narrows to favorited
             businesses) rather than a tag. -->
        <div>
          <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ t('home.categoriesHeading') || 'Категории' }}
          </h3>
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
        </div>

        <!-- Business / service rows -->
        <template v-for="(section, sectionIdx) in businessSections" :key="section.key">
          <div v-if="section.items.length > 0 || (sectionIdx === 0 && searchQuery)">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ section.title }}</h3>
              <NuxtLink :to="section.to" class="text-sm font-medium text-blue-600 dark:text-blue-400">
                {{ t('home.seeAll') || 'Все' }}
              </NuxtLink>
            </div>
            <div v-if="sectionIdx === 0" class="relative mb-3">
              <UIcon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                v-model="searchQuery"
                type="search"
                :placeholder="t('home.searchBusinesses') || 'Поиск заведений'"
                class="w-full pl-9 pr-3 py-2 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                @input="onSearchInput"
              >
            </div>
            <p v-if="section.items.length === 0" class="text-sm text-gray-400 py-6 text-center">
              {{ t('home.noSearchResults') || 'Ничего не найдено' }}
            </p>
            <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
              <div class="flex gap-3 snap-x">
                <div
                  v-for="biz in section.items"
                  :key="biz.key"
                  class="flex-shrink-0 w-44 sm:w-48 snap-start"
                >
                  <BusinessCard
                    :business="biz"
                    :is-favorite="favoriteIds.has(biz.key)"
                    @toggle-favorite="toggleFavorite"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- No Patron identity: a standard login banner, not a full-page
               gate -- the Catalog is public and stays browsable either way.
               Placed after the first feed row (not at the very top) so it
               reads as part of the feed, not a wall. A hub-authenticated
               visitor never actually sees this -- autoProvisionPatron()
               resolves before this would render for them. Once signed in,
               this banner is gone and nothing replaces it: the header's
               avatar carries the personalized content instead, so logging
               in causes no page layout change. -->
          <div
            v-if="sectionIdx === 0 && !hasPatronToken"
            class="rounded-3xl p-6 md:p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center gap-6"
          >
            <div class="flex-shrink-0 w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <UIcon name="lucide:gift" class="w-7 h-7 text-amber-500" />
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{{ t('home.title') || 'Каталог' }}</h1>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ t('home.publicHint') || 'Заказы, карты лояльности и заведения рядом. Войдите, чтобы сохранить историю за собой.' }}</p>
              <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <li class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <UIcon name="lucide:check" class="w-3.5 h-3.5 text-amber-500" />
                  {{ t('home.benefitBonuses') || 'Бонусы за заказы' }}
                </li>
                <li class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <UIcon name="lucide:check" class="w-3.5 h-3.5 text-amber-500" />
                  {{ t('home.benefitHistory') || 'История заказов' }}
                </li>
                <li class="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <UIcon name="lucide:check" class="w-3.5 h-3.5 text-amber-500" />
                  {{ t('home.benefitFavorites') || 'Избранные заведения' }}
                </li>
              </ul>
            </div>
            <button
              type="button"
              class="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="patronLogin()"
            >
              <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span class="truncate">{{ t('home.loginCta') || 'Войти' }}</span>
            </button>
          </div>
        </template>

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
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.3s ease;
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
}
</style>
