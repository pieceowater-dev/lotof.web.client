<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { useAppInstallStatus } from '@/composables/useAppInstallStatus';
import { useConsoleAccess } from '@/composables/useConsoleAccess';
import { useImpersonation } from '@/composables/useImpersonation';
import GuideWidget from '@/components/guide/GuideWidget.vue';
import { LSKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';

const { t, locale, setLocale } = useI18n();
const toast = useToast();
const router = useRouter();
const route = useRoute();

// / replaces the whole header with the business ribbon (see the header
// template below) -- it's a marketing landing page, not a place that needs
// the app nav/burger menu.
const isLandingPage = computed(() => route.path === '/');

// /catalog and its single-vertical filtered views (/stores, /services) are
// the Patron-facing public marketplace -- the hub nav (Home/Console/apps)
// makes no sense there, so they share header content: catalog-family nav
// plus Patron auth status instead.
const isCatalogPage = computed(() => ['/catalog', '/stores', '/services'].includes(route.path));

// Public content pages (feed, news list, a single article) -- same route
// names middleware/auth.global.ts already treats as "public content", so
// this stays in sync with that classification. The app/product nav makes
// no sense here either -- swap it for publication-category navigation, and
// send the logo/Home click to / specifically (not whatever hub/catalog was
// last chosen), since a reader landing on an article via search/share has
// no space preference yet.
const isPublicationPage = computed(() => {
  const name = typeof route.name === 'string' ? route.name : '';
  return name === 'feed' || name === 'slug' || name === 'news' || name === 'category-slug';
});
const {
  token: patronToken,
  isLoggedIn: patronLoggedIn,
  me: patronMe,
  login: patronLogin,
  logout: patronLogout,
  fetchMe: fetchPatronMe,
  refreshToken: refreshPatronToken,
} = usePatronAuth();
const patronDisplayName = computed(() => patronMe.value?.name || patronMe.value?.email || '');

// patron_token is short-lived (15 min). The catalog-family pages are
// mostly mock/static and make no authenticated calls that would otherwise
// surface an expired token and trigger a refresh, so a Patron browsing
// there for a while would silently look logged out. Refresh proactively
// on entry and keep renewing on an interval for as long as the visitor
// stays on one of these pages.
// Populate the header's Patron avatar/name during SSR too (not just after
// hydration) whenever a valid patron_token cookie came in with the request
// -- runs on both server and client, it's just a data fetch, no timers.
watch(isCatalogPage, (isCatalog) => {
  if (isCatalog && patronToken.value) fetchPatronMe();
}, { immediate: true });

if (process.client) {
  let patronRefreshTimer: ReturnType<typeof setInterval> | null = null;
  const stopPatronRefreshTimer = () => {
    if (patronRefreshTimer) {
      clearInterval(patronRefreshTimer);
      patronRefreshTimer = null;
    }
  };
  watch(isCatalogPage, async (isCatalog) => {
    if (!isCatalog) {
      stopPatronRefreshTimer();
      return;
    }

    // patron_refresh_token is httpOnly, so we can't check it directly --
    // only attempt the (otherwise guaranteed-401) refresh, and only keep
    // renewing on an interval, for a browser that has actually had a Patron
    // session before.
    let hadSessionBefore = false;
    try { hadSessionBefore = localStorage.getItem(LSKeys.HAS_PATRON_SESSION) === '1'; } catch {}

    if (!patronToken.value && hadSessionBefore) {
      await refreshPatronToken();
      if (patronToken.value) await fetchPatronMe();
    }

    stopPatronRefreshTimer();
    if (patronToken.value || hadSessionBefore) {
      // setInterval is client-only on purpose -- creating one during SSR
      // would leak a Node-process-level timer per server-rendered request
      // (there's no reliable unmount hook to clear it once the response is
      // sent), firing refreshPatronToken() against a stale request forever.
      patronRefreshTimer = setInterval(async () => {
        const refreshed = await refreshPatronToken();
        if (refreshed && patronToken.value) await fetchPatronMe(true);
      }, 10 * 60 * 1000);
    }
  }, { immediate: true });
  onBeforeUnmount(stopPatronRefreshTimer);
}

// A logged-in Patron gets no extra chrome on the page itself -- the header
// avatar opens a slide-over with their profile, bonuses, and the cross-sell
// into the hub, instead of dedicating page space to a greeting card.
const catalogSheetOpen = ref(false);
function handleCatalogLogout() {
  patronLogout();
  catalogSheetOpen.value = false;
}

// Favorited businesses: lazily loaded the first time the sheet opens with a
// Patron logged in, not on every page load -- most visits never open this.
// getCatalogBusinesses has no "fetch by ids" filter, so this fetches a
// broad batch and filters client-side; fine at the catalog's current size.
const favoritesList = ref<import('@/utils/mockCatalog').MockBusiness[]>([]);
const favoritesLoading = ref(false);
const favoritesExpanded = ref(false);
async function toggleFavoritesSection() {
  favoritesExpanded.value = !favoritesExpanded.value;
  if (!favoritesExpanded.value || !patronToken.value || favoritesList.value.length) return;
  favoritesLoading.value = true;
  try {
    const [{ getCatalogFavorites, getCatalogBusinesses, getCatalogCategories }, { toDisplayBusiness }] = await Promise.all([
      import('@/api/hub/catalog'),
      import('@/utils/mapCatalogBusiness'),
    ]);
    const [ids, categories, { rows }] = await Promise.all([
      getCatalogFavorites(patronToken.value),
      getCatalogCategories(),
      getCatalogBusinesses({}),
    ]);
    const idSet = new Set(ids);
    favoritesList.value = rows.filter((b) => idSet.has(b.id)).map((b) => toDisplayBusiness(b, categories));
  } catch (e) {
    logError('[AppHeader] failed to load favorites', e);
  } finally {
    favoritesLoading.value = false;
  }
}

const languageOptions = [
  { value: 'en', label: 'English', code: 'EN' },
  { value: 'ru', label: 'Русский', code: 'RU' },
  { value: 'kk', label: 'Қазақша', code: 'KZ' },
] as const;

const { isLoggedIn, login, user, token } = useAuth();
const { set: setPreferredSpace } = usePreferredSpace();

function handleGoToHub() {
  setPreferredSpace('hub');
  if (isLoggedIn.value) {
    router.push('/hub');
  } else {
    login('/hub');
  }
}
const { selected: selectedNS } = useNamespace();
const routeNamespace = computed(() => (route.params.namespace as string) || '');
const currentNamespace = computed(() => selectedNS.value || routeNamespace.value);
// Same source of truth the home page dashboard uses -- a header button for
// an app the namespace hasn't subscribed to must land on that app's plan
// picker, exactly like clicking the dashboard tile does, not straight into
// a half-broken unsubscribed app page.
const { resolveAppDestination, ensureAppInstallStatus } = useAppInstallStatus();
watch(currentNamespace, (ns) => {
  if (ns) ensureAppInstallStatus(ns);
}, { immediate: true });

const { isImpersonating, exitImpersonation } = useImpersonation();
const impersonating = computed(() => isImpersonating());
const exitingImpersonation = ref(false);
async function onExitImpersonation() {
  if (exitingImpersonation.value) return;
  exitingImpersonation.value = true;
  const ok = await exitImpersonation();
  if (!ok) {
    // Don't navigate on failure -- the session cookies were never swapped
    // back, so reloading would just leave the owner impersonated with no
    // visible sign of it (the banner reads owner_token, which is exactly
    // what a failed exit leaves untouched).
    exitingImpersonation.value = false;
    toast.add({
      title: t('app.exitImpersonationFailed') || 'Не удалось выйти из режима имперсонации',
      color: 'red',
    });
    return;
  }
  window.location.href = '/';
}

const { canSeeConsole, refreshConsoleAccess } = useConsoleAccess();
watch(
  () => [isLoggedIn.value, user.value?.id, token.value],
  () => refreshConsoleAccess(),
  { immediate: true }
);
function handleConsoleClick() {
  isMobileMenuOpen.value = false;
  router.push('/console');
}

// Rolled client-side only, after mount: Math.random() evaluated during SSR
// and again during client hydration are two independent rolls, and roughly
// 1 in 11 page loads would land on different outcomes -- a real, frequent
// hydration mismatch, not just a rare edge case. Defaulting to the normal
// text through hydration and only swapping in the easter egg afterward
// keeps the server/client render identical where it's compared.
const isWalter = ref(false);
onMounted(() => {
  isWalter.value = Math.random() < 1 / 1000;
});
const homeText = computed(() => isWalter.value ? 'Домой, Уолтер' : t('app.home'));
// Fixed order everywhere (see config/apps.ts) -- matches the home
// dashboard's tile order exactly, regardless of what's installed.
const navApps = computed(() => ALL_APPS);
// The Home button used to disappear once you were already on '/' -- now it
// just stays put and highlights instead, so the nav bar doesn't visibly
// reflow depending on which page you're on.
const showHomeItem = computed(() => true);
const isHomeActive = computed(() => route.path === '/');
const isMobileMenuOpen = ref(false);
const shouldUseBurger = ref(true);
const headerInnerRef = ref<HTMLElement | null>(null);
const brandRef = ref<HTMLElement | null>(null);
const desktopMeasureRef = ref<HTMLElement | null>(null);
const desktopHelpMeasureRef = ref<HTMLElement | null>(null);
let headerResizeObserver: ResizeObserver | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

// Гид -- единая кнопка на всех страницах, открывает GuideWidget (тур
// запускается изнутри виджета, а не напрямую по клику на кнопку).
const showHelpButton = computed(() => true);
const isGuideOpen = ref(false);

function handleHelpClick() {
  isGuideOpen.value = true;
}

const { get: getPreferredSpace } = usePreferredSpace();

// Returning visitors skip the / landing choice -- their last pick (hub
// workspace vs. patron catalog) sends them straight there. Nobody has
// chosen yet -> / itself, which is where the choice lives.
function preferredSpacePath(): string {
  // A reader on an article/feed page has no space preference in play here
  // -- they arrived via search/share, not by picking hub or catalog -- so
  // the logo/Home always goes to the plain landing page from here.
  if (isPublicationPage.value) return '/';

  const pref = getPreferredSpace();
  if (pref === 'hub') return '/hub';
  if (pref === 'catalog') return '/catalog';
  return '/';
}

function handleHomeClick() {
  isMobileMenuOpen.value = false;
  router.push(preferredSpacePath());
}

function handleMenuSelect(app: AppConfig) {
  if (!app.canAdd) {
    toast.add({
      title: t('app.comingSoonToast') || 'Скоро станет доступным!',
      color: 'gray',
    });
    return;
  }
  if (!isLoggedIn.value) return login();
  const ns = currentNamespace.value;
  if (!ns) return;

  isMobileMenuOpen.value = false;
  router.push(resolveAppDestination(app, ns));
}

function isAppActive(app: AppConfig) {
  // Match the address as the path segment right after the namespace
  // (`/<ns>/<address>` or `/<ns>/<address>/...`), NOT as a substring — a
  // per-app tariff page like `/<ns>/goods/plans` otherwise lit up both
  // "Goods" and "Запись".
  return new RegExp(`^/[^/]+/${app.address}(/|$)`).test(route.path);
}

function debouncedUpdateMenuMode() {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    updateMenuMode();
    resizeTimeout = null;
  }, 100);
}

function updateMenuMode() {
  const headerInner = headerInnerRef.value;
  const brand = brandRef.value;
  const desktopMeasure = desktopMeasureRef.value;

  if (!headerInner || !brand || !desktopMeasure) {
    shouldUseBurger.value = true;
    return;
  }

  const reservedSpacing = showHelpButton.value ? 40 : 24;
  const availableWidth = headerInner.clientWidth - brand.offsetWidth - reservedSpacing;
  const helpWidth = showHelpButton.value ? (desktopHelpMeasureRef.value?.offsetWidth ?? 0) + 8 : 0;
  const requiredWidth = desktopMeasure.scrollWidth + helpWidth;

  shouldUseBurger.value = requiredWidth > Math.max(availableWidth, 0);
}

async function syncMenuMode() {
  await nextTick();
  debouncedUpdateMenuMode();
}

onMounted(() => {
  syncMenuMode();

  headerResizeObserver = new ResizeObserver(() => {
    debouncedUpdateMenuMode();
  });

  if (headerInnerRef.value) headerResizeObserver.observe(headerInnerRef.value);
  if (brandRef.value) headerResizeObserver.observe(brandRef.value);
  if (desktopMeasureRef.value) headerResizeObserver.observe(desktopMeasureRef.value);
  if (desktopHelpMeasureRef.value) headerResizeObserver.observe(desktopHelpMeasureRef.value);
});

onBeforeUnmount(() => {
  headerResizeObserver?.disconnect();
  headerResizeObserver = null;
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = null;
});

watch(
  () => [route.fullPath, showHomeItem.value, showHelpButton.value, canSeeConsole.value],
  () => {
    syncMenuMode();
  }
);

const goHome = () => {
  router.push(preferredSpacePath());
};
</script>

<template>
  <!-- blur strip covering the top gap above the floating header -->
  <div class="fixed top-0 left-0 right-0 h-3 z-50 backdrop-blur-sm pointer-events-none" />
  <header
    class="hdr-shell fixed top-3 left-2 right-2 z-50"
  >
    <div
      ref="headerInnerRef"
      class="flex w-full items-center justify-between px-4 py-2 md:px-5 md:py-2 lg:px-6"
    >
      <div
        v-if="impersonating"
        class="flex items-center gap-2 shrink-0 rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      >
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
        <span class="max-w-[10rem] truncate text-xs font-medium md:max-w-xs md:text-sm">{{ user?.email || user?.username }}</span>
        <button
          type="button"
          class="shrink-0 text-amber-700 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white"
          :disabled="exitingImpersonation"
          @click="onExitImpersonation"
        >
          <Icon name="lucide:x" class="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        v-else
        ref="brandRef"
        class="flex items-center space-x-1 cursor-pointer shrink-0"
        role="button"
        tabindex="0"
        @click="goHome"
        @keydown.enter="goHome"
      >
        <picture>
          <source srcset="/assets/logo.webp" type="image/webp">
          <img
            src="/assets/logo.png"
            alt="Logo"
            width="20"
            height="20"
            class="h-5 w-5"
          >
        </picture>
        <span class="text-base md:text-lg">lota</span>
      </div>

      <!-- / replaces the nav/burger with the business ribbon -- it's the
           marketing landing page, not somewhere the app nav belongs. -->
      <div
        v-if="isLandingPage"
        class="flex min-w-0 flex-1 items-center justify-end gap-3 pl-4"
      >
        <p class="hidden sm:flex min-w-0 truncate text-sm text-gray-600 dark:text-gray-300 items-center gap-1.5">
          <UIcon name="lucide:briefcase" class="w-4 h-4 flex-shrink-0" />
          {{ t('app.hubRibbonText') || 'Работаете на lota?' }}
        </p>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            class="hdr-cta hidden sm:inline-flex"
            @click="handleGoToHub"
          >
            <svg v-if="!isLoggedIn" class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span class="truncate">{{ isLoggedIn ? (t('app.hubRibbonCtaLoggedIn') || 'Рабочее пространство') : (t('app.hubRibbonCta') || 'Войти через Google') }}</span>
          </button>
          <div class="hdr-lang-group">
            <button
              v-for="lang in languageOptions"
              :key="lang.value"
              type="button"
              class="hdr-lang"
              :class="locale === lang.value
                ? 'hdr-lang--on'
                : ''"
              :title="lang.label"
              @click="setLocale(lang.value)"
            >
              {{ lang.code }}
            </button>
          </div>
        </div>
      </div>

      <!-- /catalog and its filtered views (/stores, /services) are the
           Patron-facing public marketplace -- Patron auth status instead of
           the hub nav, plus nav between the three catalog-family pages. -->
      <div
        v-else-if="isCatalogPage"
        class="flex min-w-0 flex-1 items-center justify-end gap-3 pl-4"
      >
        <nav class="hidden md:flex min-w-0 items-center gap-1 mr-1">
          <NuxtLink
            to="/catalog"
            class="hdr-item"
            :class="route.path === '/catalog'
              ? 'hdr-item--on'
              : ''"
          >
            <UIcon name="lucide:layout-grid" class="h-4 w-4" />
            <span class="truncate">{{ t('home.title') || 'Каталог' }}</span>
          </NuxtLink>
          <NuxtLink
            to="/stores"
            class="hdr-item"
            :class="route.path === '/stores'
              ? 'hdr-item--on'
              : ''"
          >
            <UIcon name="lucide:utensils" class="h-4 w-4" />
            <span class="truncate">{{ t('home.storesTitle') || 'Заведения' }}</span>
          </NuxtLink>
          <NuxtLink
            to="/services"
            class="hdr-item"
            :class="route.path === '/services'
              ? 'hdr-item--on'
              : ''"
          >
            <UIcon name="lucide:scissors" class="h-4 w-4" />
            <span class="truncate">{{ t('home.servicesTitle') || 'Услуги' }}</span>
          </NuxtLink>
        </nav>
        <template v-if="patronLoggedIn">
          <button
            type="button"
            class="hdr-chip !pl-1 !pr-3 !py-1"
            @click="catalogSheetOpen = true"
          >
            <span class="hdr-avatar">
              {{ (patronDisplayName || '?').charAt(0).toUpperCase() }}
            </span>
            <span class="hidden sm:inline min-w-0 max-w-[9rem] truncate text-sm font-medium text-gray-700 dark:text-gray-200">{{ patronDisplayName }}</span>
          </button>
        </template>
        <button
          v-else
          type="button"
          class="hdr-chip"
          @click="patronLogin()"
        >
          <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span class="truncate">{{ t('home.loginCta') || 'Войти' }}</span>
        </button>
        <div class="hdr-lang-group">
          <button
            v-for="lang in languageOptions"
            :key="lang.value"
            type="button"
            class="hdr-lang"
            :class="locale === lang.value
              ? 'hdr-lang--on'
              : ''"
            :title="lang.label"
            @click="setLocale(lang.value)"
          >
            {{ lang.code }}
          </button>
        </div>
      </div>

      <!-- Feed/news/article pages: navigation between publication
           categories, not the product/app nav -- browsing a blog post has
           nothing to do with picking an app. -->
      <div
        v-else-if="isPublicationPage"
        class="flex min-w-0 flex-1 items-center justify-end gap-2 pl-4"
      >
        <nav class="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto">
          <NuxtLink
            to="/feed"
            class="hdr-item"
            :class="route.path === '/feed'
              ? 'hdr-item--on'
              : ''"
          >
            <UIcon name="lucide:newspaper" class="h-4 w-4" />
            <span class="truncate">{{ t('app.feed') || 'Лента' }}</span>
          </NuxtLink>
          <NuxtLink
            to="/news"
            class="hdr-item"
            :class="route.path === '/news'
              ? 'hdr-item--on'
              : ''"
          >
            <UIcon name="lucide:radio" class="h-4 w-4" />
            <span class="truncate">{{ t('app.news') || 'Новости' }}</span>
          </NuxtLink>
        </nav>
        <div class="hdr-lang-group">
          <button
            v-for="lang in languageOptions"
            :key="lang.value"
            type="button"
            class="hdr-lang"
            :class="locale === lang.value
              ? 'hdr-lang--on'
              : ''"
            :title="lang.label"
            @click="setLocale(lang.value)"
          >
            {{ lang.code }}
          </button>
        </div>
      </div>

      <template v-else>
        <div
          v-if="!shouldUseBurger"
          class="flex min-w-0 flex-1 items-center justify-end gap-2 pl-4 md:pl-5 lg:pl-6"
        >
          <nav class="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto">
            <button
              v-if="showHomeItem"
              type="button"
              class="hdr-item"
              :class="isHomeActive
                ? 'hdr-item--on'
                : ''"
              @click="handleHomeClick"
            >
              <UIcon
                name="i-lucide-home"
                class="h-4 w-4"
              />
              <span class="truncate">{{ homeText }}</span>
            </button>

            <button
              v-if="canSeeConsole"
              type="button"
              class="hdr-item"
              @click="handleConsoleClick"
            >
              <UIcon
                name="lucide:terminal-square"
                class="h-4 w-4"
              />
              <span class="truncate">Console</span>
            </button>

            <button
              v-for="app in navApps"
              :key="app.bundle"
              type="button"
              class="hdr-item"
              :class="[
                isAppActive(app)
                  ? 'hdr-item--on'
                  : '',
                !isAppActive(app) && !app.canAdd ? 'hdr-item--off' : '',
              ]"
              :aria-disabled="!app.canAdd"
              @click="handleMenuSelect(app)"
            >
              <UIcon
                :name="app.icon"
                class="h-4 w-4"
              />
              <span class="truncate">{{ t(app.titleKey) }}</span>
            </button>
          </nav>

          <UButton
            v-if="showHelpButton"
            data-tour="help-button"
            variant="ghost"
            size="sm"
            :aria-label="t('guide.openGuide') || 'Open lota Гид'"
            :title="t('guide.openGuide') || 'Open lota Гид'"
            @click="handleHelpClick"
          >
            <UIcon name="i-lucide-life-buoy" />
          </UButton>
        </div>

        <div
          v-if="shouldUseBurger"
          class="flex shrink-0 items-center gap-1 pl-4"
        >
          <UButton
            v-if="showHelpButton"
            data-tour="help-button"
            variant="ghost"
            size="sm"
            :aria-label="t('guide.openGuide') || 'Open lota Гид'"
            :title="t('guide.openGuide') || 'Open lota Гид'"
            @click="handleHelpClick"
          >
            <UIcon name="i-lucide-life-buoy" />
          </UButton>

          <UButton
            variant="ghost"
            size="sm"
            :aria-label="t('app.feedMenu') || 'Open menu'"
            @click="isMobileMenuOpen = true"
          >
            <UIcon name="i-lucide-menu" />
          </UButton>
        </div>
      </template>
    </div>

    <div class="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
      <div class="flex items-center gap-2 whitespace-nowrap">
        <div
          ref="desktopMeasureRef"
          class="flex items-center gap-2"
        >
          <button
            v-if="showHomeItem"
            type="button"
            class="hdr-item"
          >
            <UIcon
              name="i-lucide-home"
              class="h-4 w-4"
            />
            <span>{{ homeText }}</span>
          </button>

          <button
            v-if="canSeeConsole"
            type="button"
            class="hdr-item"
          >
            <UIcon
              name="lucide:terminal-square"
              class="h-4 w-4"
            />
            <span>Console</span>
          </button>

          <button
            v-for="app in navApps"
            :key="`measure-${app.bundle}`"
            type="button"
            class="hdr-item"
          >
            <UIcon
              :name="app.icon"
              class="h-4 w-4"
            />
            <span>{{ t(app.titleKey) }}</span>
          </button>
        </div>

        <div
          v-if="showHelpButton"
          ref="desktopHelpMeasureRef"
          class="flex shrink-0"
        >
          <UButton
            variant="ghost"
            size="sm"
          >
            <UIcon name="i-lucide-life-buoy" />
          </UButton>
        </div>
      </div>
    </div>
  </header>

  <!-- blur strip covering the bottom gap below the floating sheet -->
  <div
    v-if="isMobileMenuOpen"
    class="fixed bottom-0 left-0 right-0 h-3 z-[60] backdrop-blur-sm pointer-events-none"
  />

  <UModal
    v-model="isMobileMenuOpen"
    class="menu-bottom-sheet"
    :transition="false"
    :ui="{
      container: 'items-end pb-3 px-2',
      base: 'w-full rounded-3xl backdrop-blur-md bg-white/90 dark:bg-gray-800/90 border border-blue-100/80 dark:border-gray-700 shadow-sm'
    }"
  >
    <div class="p-4 max-h-[80vh] overflow-auto">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-base font-semibold">
          {{ t('app.apps') }}
        </h3>
        <UButton
          variant="ghost"
          icon="lucide:x"
          :aria-label="t('app.cancel') || 'Close menu'"
          @click="isMobileMenuOpen = false"
        />
      </div>

      <div class="space-y-2">
        <button
          v-if="showHomeItem"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
          :class="isHomeActive ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          @click="handleHomeClick"
        >
          <UIcon
            name="i-lucide-home"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="text-sm font-medium truncate" :class="isHomeActive && 'text-primary'">{{ homeText }}</span>
        </button>

        <button
          v-if="canSeeConsole"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          @click="handleConsoleClick"
        >
          <UIcon
            name="lucide:terminal-square"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="flex-1 text-sm font-medium truncate">Console</span>
        </button>

        <button
          v-for="app in navApps"
          :key="app.bundle"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          :class="{ 'text-gray-400 dark:text-gray-500': !app.canAdd }"
          :aria-disabled="!app.canAdd"
          @click="handleMenuSelect(app)"
        >
          <UIcon
            :name="app.icon"
            class="h-5 w-5 text-primary flex-shrink-0"
          />
          <span class="flex-1 text-sm font-medium truncate">{{ t(app.titleKey) }}</span>
        </button>
      </div>
    </div>
  </UModal>

  <GuideWidget v-model="isGuideOpen" />

  <!-- Catalog profile sheet: everything a logged-in Patron might want
       (bonuses, orders/favorites, cross-sell into the hub) lives here
       instead of on the page, so logging in doesn't change the page layout. -->
  <USlideover
    v-if="isCatalogPage"
    v-model="catalogSheetOpen"
    side="bottom"
    :ui="{
      base: 'relative flex flex-none flex-col w-[94%] max-w-md mx-auto focus:outline-none',
      height: 'h-auto max-h-[90vh]',
      rounded: 'rounded-t-[2rem]',
      background: 'bg-white dark:bg-[#1a1a1a]',
      ring: 'ring-1 ring-black/5 dark:ring-white/10',
      shadow: 'shadow-2xl',
    }"
  >
    <div class="profile-sheet flex h-full flex-col gap-5 overflow-y-auto px-5 pb-6 pt-3">
      <!-- grab handle -->
      <span class="mx-auto h-1 w-10 flex-shrink-0 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />

      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3.5">
          <span class="profile-avatar">
            {{ (patronDisplayName || '?').charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ patronDisplayName }}</p>
            <p v-if="patronMe?.email" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ patronMe.email }}</p>
          </div>
        </div>
        <button type="button" class="profile-icon-btn" :aria-label="t('app.cancel') || 'Close'" @click="catalogSheetOpen = false">
          <UIcon name="lucide:x" class="h-4 w-4" />
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="profile-tile">
          <span class="profile-tile__icon"><UIcon name="lucide:receipt" class="h-5 w-5" /></span>
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('home.ordersTitle') || 'Заказы' }}</span>
        </div>
        <button
          type="button"
          class="profile-tile profile-tile--btn"
          :class="favoritesExpanded ? 'profile-tile--rose' : ''"
          :aria-expanded="favoritesExpanded"
          @click="toggleFavoritesSection"
        >
          <span class="profile-tile__icon" :class="favoritesExpanded ? '!bg-rose-100 !text-rose-500 dark:!bg-rose-500/20' : ''">
            <UIcon name="lucide:heart" class="h-5 w-5" :class="favoritesExpanded ? 'fill-rose-500' : ''" />
          </span>
          <span class="text-sm font-semibold" :class="favoritesExpanded ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-gray-100'">{{ t('home.favoritesTitle') || 'Избранное' }}</span>
        </button>
      </div>

      <div v-if="favoritesExpanded" class="catalog-panel overflow-hidden !rounded-3xl p-1.5">
        <p v-if="favoritesLoading" class="p-4 text-xs text-gray-400">{{ t('app.loading') || 'Загрузка…' }}</p>
        <p v-else-if="!favoritesList.length" class="p-4 text-xs text-gray-400">{{ t('home.noFavoritesYet') || 'Пока нет избранных заведений' }}</p>
        <ul v-else class="max-h-56 space-y-0.5 overflow-y-auto">
          <li v-for="biz in favoritesList" :key="biz.key">
            <NuxtLink :to="biz.to" class="profile-row" @click="catalogSheetOpen = false">
              <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br" :class="biz.gradient">
                <img v-if="biz.logoUrl" :src="biz.logoUrl" :alt="biz.name" class="h-full w-full object-cover">
                <UIcon v-else :name="biz.icon" class="h-4 w-4" :class="biz.iconColor" />
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ biz.name }}</span>
              <UIcon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
            </NuxtLink>
          </li>
        </ul>
      </div>

      <!-- Cross-sell into the business side -- clearly a jump away from the
           catalog, not one of its own features. -->
      <button type="button" class="catalog-panel group flex items-center justify-between gap-3 p-4 text-left transition-transform duration-500 hover:-translate-y-0.5" @click="handleGoToHub">
        <span class="flex min-w-0 items-center gap-3">
          <span class="icon-tile !h-11 !w-11 !rounded-2xl"><UIcon name="lucide:briefcase" class="h-5 w-5" /></span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-bold text-gray-900 dark:text-white">{{ t('home.workWithLotaTitle') || 'Работать с lota' }}</span>
            <span class="block text-xs leading-5 text-gray-500 dark:text-gray-400">{{ t('home.workWithLotaHint') || 'Работаете на lota? Перейти в рабочее пространство' }}</span>
          </span>
        </span>
        <UIcon name="lucide:arrow-right" class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-500 group-hover:translate-x-0.5" />
      </button>

      <button type="button" class="profile-logout" @click="handleCatalogLogout">
        <UIcon name="lucide:log-out" class="h-4 w-4" />
        {{ t('app.logout') || 'Выйти' }}
      </button>
    </div>
  </USlideover>
</template>
