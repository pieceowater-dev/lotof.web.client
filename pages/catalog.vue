<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getApiBasePath } from '@/utils/api-base';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';
import { menuBusinesses, plansBarbershops, plansBeauty } from '@/utils/mockCatalog';
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

// -- Mock marketplace feed -------------------------------------------------
// There is no live business directory yet -- this is placeholder content
// only, styled after Yandex Eda / Ozon / Glovo-style browse feeds, so the
// Catalog's shape is validated before any real data source exists.

const promoBanners = [
  {
    key: 'discount',
    icon: 'lucide:percent',
    title: 'Скидка до 20%',
    subtitle: 'На первый заказ через lota',
    gradient: 'from-orange-100 to-amber-50',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-950',
    subtitleColor: 'text-amber-800',
  },
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

const categories = [
  { key: 'cafe', icon: 'lucide:coffee', label: 'Кафе' },
  { key: 'restaurant', icon: 'lucide:utensils', label: 'Рестораны' },
  { key: 'barbershop', icon: 'lucide:scissors', label: 'Барбершопы' },
  { key: 'nails', icon: 'lucide:sparkles', label: 'Маникюр' },
  { key: 'spa', icon: 'lucide:flower-2', label: 'Спа и массаж' },
  { key: 'beauty', icon: 'lucide:wand-2', label: 'Косметология' },
  { key: 'fitness', icon: 'lucide:dumbbell', label: 'Фитнес' },
  { key: 'auto', icon: 'lucide:car', label: 'Автосервис' },
  { key: 'repair', icon: 'lucide:wrench', label: 'Ремонт' },
  { key: 'flowers', icon: 'lucide:flower', label: 'Цветы' },
] as const;
const activeCategory = ref('cafe');

const featuredShops = [
  { key: 'shop1', name: 'Coffee Boom', icon: 'lucide:coffee', color: 'bg-amber-100 text-amber-600', hint: '15–25 мин' },
  { key: 'shop2', name: 'Своя Пекарня', icon: 'lucide:croissant', color: 'bg-orange-100 text-orange-600', hint: '20–30 мин' },
  { key: 'shop3', name: 'Barber Club', icon: 'lucide:scissors', color: 'bg-blue-100 text-blue-600', hint: 'До 21:00' },
  { key: 'shop4', name: 'Nail Bar', icon: 'lucide:sparkles', color: 'bg-pink-100 text-pink-600', hint: 'До 20:00' },
  { key: 'shop5', name: 'Fitness Loft', icon: 'lucide:dumbbell', color: 'bg-emerald-100 text-emerald-600', hint: 'Круглосуточно' },
  { key: 'shop6', name: 'АвтоМастер', icon: 'lucide:car', color: 'bg-slate-100 text-slate-600', hint: '30–40 мин' },
] as const;

// Mixed feed: a bit of everything (lota Menu + lota Plans businesses) --
// see pages/stores.vue and pages/services.vue for the single-vertical
// filtered views, linked to from the "browse by category" row below.
const businessSections = [
  { key: 'popular', title: 'Популярное рядом', items: menuBusinesses.slice(0, 4) },
  { key: 'barbers', title: 'Стрижка и барбершопы', items: plansBarbershops },
  { key: 'beauty', title: 'Красота и уход', items: plansBeauty },
];

const favorites = ref<Set<string>>(new Set());
function toggleFavorite(key: string) {
  const next = new Set(favorites.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  favorites.value = next;
}

const siteUrl = 'https://lota.tools';
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
      <!-- Marketplace-style browse feed: mock content only (no live
           business directory yet) -- categories, promo banners, and
           horizontally scrolling business/service rows, browsable whether
           or not a Patron identity is present. -->
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

        <!-- Categories -->
        <div>
          <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ t('home.categoriesHeading') || 'Категории' }}
          </h3>
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
        </div>

        <!-- Featured shops -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('home.shopsHeading') || 'Заведения' }}
            </h3>
            <button type="button" class="text-sm font-medium text-blue-600 dark:text-blue-400">
              {{ t('home.seeAll') || 'Все' }}
            </button>
          </div>
          <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
            <div class="flex gap-3">
              <div v-for="shop in featuredShops" :key="shop.key" class="flex-shrink-0 w-24 flex flex-col items-center text-center gap-2">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm" :class="shop.color">
                  <UIcon :name="shop.icon" class="w-7 h-7" />
                </div>
                <div class="w-24">
                  <p class="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{{ shop.name }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">{{ shop.hint }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Business / service rows -->
        <template v-for="(section, sectionIdx) in businessSections" :key="section.key">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ section.title }}</h3>
              <button type="button" class="text-sm font-medium text-blue-600 dark:text-blue-400">
                {{ t('home.seeAll') || 'Все' }}
              </button>
            </div>
            <div class="overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
              <div class="flex gap-3 snap-x">
                <div
                  v-for="biz in section.items"
                  :key="biz.key"
                  class="flex-shrink-0 w-44 sm:w-48 snap-start"
                >
                  <BusinessCard
                    :business="biz"
                    :is-favorite="favorites.has(biz.key)"
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
               avatar + profile sheet carries the personalized content
               instead, so logging in causes no page layout change. -->
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
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.3s ease;
}
.banner-fade-enter-from,
.banner-fade-leave-to {
  opacity: 0;
}
</style>
