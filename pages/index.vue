<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import { useAppInstallStatus } from '@/composables/useAppInstallStatus';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';
import { extractFirstImage, excerptFromMarkdown, estimateReadTimeMinutes, formatPublishedDate } from '@/utils/markdown';

// Composables
const { user, isLoggedIn, initialized, justLoggedOut, fetchUser, login } = useAuth();
const { selected: selectedNS } = useNamespace();
const { set: setPreferredSpace } = usePreferredSpace();

const router = useRouter();
const route = useRoute();
const toast = useToast();

const { appInstalled, appRoutePath: sharedAppRoutePath, ensureAppInstallStatus } = useAppInstallStatus();

// Both entry-point cards remember the visitor's choice (see AppHeader's
// header-logo shortcut) and act as Google auth triggers where needed --
// the Hub always requires a hub session; the Catalog never does.
function handleGoToHub() {
  setPreferredSpace('hub');
  if (isLoggedIn.value) {
    router.push('/hub');
  } else {
    login('/hub');
  }
}

function handleGoToCatalog() {
  setPreferredSpace('catalog');
  router.push('/catalog');
}

const catalogFeatures = [
  { key: 'businesses', icon: 'lucide:store', titleKey: 'app.catalogFeatureBusinessesTitle', descKey: 'app.catalogFeatureBusinessesDesc' },
  { key: 'ratings', icon: 'lucide:star', titleKey: 'app.catalogFeatureRatingsTitle', descKey: 'app.catalogFeatureRatingsDesc' },
  { key: 'services', icon: 'lucide:briefcase', titleKey: 'app.catalogFeatureServicesTitle', descKey: 'app.catalogFeatureServicesDesc' },
  { key: 'more', icon: 'lucide:sparkles', titleKey: 'app.catalogFeatureMoreTitle', descKey: 'app.catalogFeatureMoreDesc' },
] as const;

// Plain (non-opacity-modified) Tailwind gradient utility classes render
// fine in this app -- it's specifically the `/opacity` modifier on
// gradient-stop classes that @nuxt/ui's regenerated color palette breaks
// (see the removed inline-style workaround this used briefly). Going light
// via genuinely light shades (50/100) sidesteps that landmine entirely.
const catalogSlides = [
  { key: 'businesses', icon: 'lucide:store', headlineKey: 'app.catalogSlideBusinessesTitle', descKey: 'app.catalogSlideBusinessesDesc', gradient: 'from-blue-50 to-indigo-100', iconColor: 'text-indigo-400', headlineColor: 'text-indigo-950', descColor: 'text-indigo-800', accentColor: 'rgba(129, 140, 248, 0.35)' },
  { key: 'ratings', icon: 'lucide:star', headlineKey: 'app.catalogSlideRatingsTitle', descKey: 'app.catalogSlideRatingsDesc', gradient: 'from-amber-50 to-orange-100', iconColor: 'text-orange-400', headlineColor: 'text-amber-950', descColor: 'text-amber-800', accentColor: 'rgba(251, 146, 60, 0.35)' },
  { key: 'services', icon: 'lucide:briefcase', headlineKey: 'app.catalogSlideServicesTitle', descKey: 'app.catalogSlideServicesDesc', gradient: 'from-rose-50 to-pink-100', iconColor: 'text-pink-400', headlineColor: 'text-rose-950', descColor: 'text-rose-800', accentColor: 'rgba(244, 114, 182, 0.35)' },
  { key: 'more', icon: 'lucide:sparkles', headlineKey: 'app.catalogSlideMoreTitle', descKey: 'app.catalogSlideMoreDesc', gradient: 'from-fuchsia-50 to-purple-100', iconColor: 'text-purple-400', headlineColor: 'text-fuchsia-950', descColor: 'text-fuchsia-800', accentColor: 'rgba(192, 132, 252, 0.35)' },
] as const;

const activeCatalogSlide = ref(0);
let catalogSlideTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  if (!process.client) return;
  catalogSlideTimer = setInterval(() => {
    activeCatalogSlide.value = (activeCatalogSlide.value + 1) % catalogSlides.length;
  }, 4500);
});

onBeforeUnmount(() => {
  if (catalogSlideTimer) clearInterval(catalogSlideTimer);
});

onMounted(async () => {
  // 1) Wait a tick for cookies to be available after OAuth redirect
  await nextTick();

  // 2) Resolve auth state BEFORE deciding whether auto-login is needed --
  // on a fresh page load (e.g. arriving via a deep link) the readable
  // `token` cookie is often absent even for a genuinely logged-in visitor
  // (only the httpOnly refresh_token survives), and fetchUser() is what
  // performs the silent refresh that repopulates it. Checking isLoggedIn
  // before this ran incorrectly bounced already-logged-in users through a
  // fresh OAuth flow.
  await fetchUser();

  // 2.1) Immediate auto-login if redirected with auth-needed flag and truly
  // not logged in (post-fetchUser, so this reflects real auth state).
  const q0 = route.query;
  if (!isLoggedIn.value && (q0['auth-needed'] === 'true' || q0['authNeeded'] === 'true')) {
    if (justLoggedOut.value) {
      // The user just hit Logout -- if auth-needed=true is on the URL again
      // this fast (stale history entry, address-bar autocomplete, a tab that
      // didn't fully unload), firing login() here would silently sign them
      // back in via their still-active Google session and make Logout look
      // like it does nothing. Consume the flag once and just drop the query
      // param instead of auto-triggering a fresh login.
      justLoggedOut.value = false;
      const cleaned = { ...route.query } as any;
      delete cleaned['auth-needed'];
      delete cleaned['authNeeded'];
      router.replace({ path: route.path, query: cleaned });
      return;
    }
    login();
    return;
  }

  if (user.value) {
    // A deep link tagged a target app (see server/routes/l/[code].get.ts) --
    // this covers both a brand-new signup landing back here after OAuth
    // (cookie survives the round-trip) and an already-logged-in visitor who
    // just clicked the link, which is the more common case in practice.
    const navigated = await handlePendingTargetApp();
    if (navigated) return;

    // Run app installation check in background so first paint is not blocked.
    checkInstalledForVisibleApps().catch((error) => {
      logError('[apps] startup install check failed', error);
    });
  }

  // 2.5) If authenticated and we have a back-to target, redirect back once
  if (isLoggedIn.value && process.client) {
    try {
      const bt = localStorage.getItem('back-to');
      if (bt) {
        localStorage.removeItem('back-to');
        const target = bt.startsWith('/') ? bt : `/${bt}`;
        return router.replace(target);
      }
    } catch {}
  }

  // 3) If user is already logged in but URL still has the hint, scrub it
  const needsScrub = route.query['auth-needed'] === 'true' || route.query['authNeeded'] === 'true';
  if (isLoggedIn.value && needsScrub) {
    const cleaned = { ...route.query } as any;
    delete cleaned['auth-needed'];
    delete cleaned['authNeeded'];
    router.replace({ path: route.path, query: cleaned });
  }
});

async function handleAppClick(appAddress: string) {
  if (!isLoggedIn.value) return login();
  const ns = selectedNS.value;
  if (!ns) return;
  // If opening A-Trace, first exchange for an app token with required headers
  if (appAddress === 'atrace') {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN).value;
      if (!hubToken) return login();
      const { ensure } = useAtraceToken();
      const atraceToken = await ensure(ns, hubToken);
      // Ensure cookie is present before navigating; otherwise, stop and notify
      if (!atraceToken || !useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value) {
        toast.add({
          title: t('app.atraceTitle') || 'A-Trace',
          description: t('app.appTokenFailed') || 'Failed to get app token. Please try again later.',
          color: 'red'
        });
        return;
      }
    } catch (e) {
      logError('[atrace] getAppToken failed', e);
      toast.add({
        title: t('app.atraceTitle') || 'A-Trace',
        description: t('app.appTokenError') || 'Failed to get app token.',
        color: 'red'
      });
      return;
    }
  }
  if (appAddress === 'contacts') {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN).value;
      if (!hubToken) return login();
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(ns, hubToken);
      if (!contactsToken || !useCookie<string | null>(CookieKeys.CONTACTS_TOKEN, { path: '/' }).value) {
        toast.add({
          title: t('app.contacts') || 'Contacts',
          description: t('app.appTokenFailed') || 'Failed to get app token. Please try again later.',
          color: 'red'
        });
        return;
      }
    } catch (e) {
      logError('[contacts] getAppToken failed', e);
      toast.add({
        title: t('app.contacts') || 'Contacts',
        description: t('app.appTokenError') || 'Failed to get app token.',
        color: 'red'
      });
      return;
    }
  }
  // Navigate only after cookie is available (guards may read it immediately)
  await nextTick();
  // For A-Trace, always navigate to attendance/all
  const path = appAddress === 'atrace' ? `/${ns}/atrace/attendance/all` : `/${ns}/${appAddress}`;
  router.push(path);
}

async function handleGetApp(app: AppConfig) {
  if (!isLoggedIn.value) return login();
  if (!selectedNS.value) return;
  // Redirect to plan selection page before adding app to namespace
  // The user must select and subscribe to a plan first
  await router.push({
    path: `/${selectedNS.value}/${app.address}/plans`,
    query: { returnTo: `/${selectedNS.value}/${app.address}` }
  });
}

const { t, locale } = useI18n();
const config = useRuntimeConfig();
const siteUrl = (config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');

useSeoMeta({
  title: () => t('app.title') || 'lota',
  description: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogTitle: () => t('app.title') || 'lota',
  ogDescription: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogType: 'website',
  ogUrl: `${siteUrl}/`,
  ogImage: () => `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('app.title') || 'lota',
  twitterDescription: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  twitterImage: () => `${siteUrl}/og-image.png`
});

useHead({
  title: 'lota — Платформа автоматизации бизнеса',
  titleTemplate: (s) => s ?? 'lota',
});

const activeApps = computed(() => ALL_APPS.filter(a => appInstalled[a.bundle]));
const possibleApps = computed(() => ALL_APPS.filter(a => !appInstalled[a.bundle] && a.canAdd));

function appRoutePath(app: AppConfig): string | null {
  const ns = selectedNS.value;
  if (!ns) return null;
  return sharedAppRoutePath(app, ns);
}

function toCard(app: AppConfig) {
  const routePath = appRoutePath(app);
  return {
    key: app.bundle,
    icon: app.icon,
    title: t(app.titleKey),
    name: app.name,
    description: t(app.descriptionKey),
    to: appInstalled[app.bundle] ? (routePath || undefined) : undefined,
    action: appInstalled[app.bundle]
      ? () => handleAppClick(app.address)
      : (app.canAdd ? () => handleGetApp(app) : undefined),
    installed: appInstalled[app.bundle] ?? false,
    canAdd: app.canAdd,
  };
}

// Consumes the target_app cookie set by a product-targeted deep link
// (server/routes/l/[code].get.ts). Returns true if it navigated the visitor
// away, so callers can skip the rest of the normal init flow.
async function handlePendingTargetApp(): Promise<boolean> {
  if (!process.client) return false;
  const targetAppCookie = useCookie<string | null>('target_app');
  const targetApp = targetAppCookie.value;
  if (!targetApp) return false;
  targetAppCookie.value = null; // consume once, whatever happens next

  const app = ALL_APPS.find(a => a.bundle === targetApp);
  if (!app) return false;

  // Namespace state is normally populated by middleware/namespace.global.ts,
  // but that only runs for /{namespace}/... routes -- a visitor arriving via
  // a landing page (/issues, /menu, ...) or any other top-level route never
  // triggers it, so selectedNS can still be empty here even though the user
  // is fully logged in. Load it directly rather than silently giving up.
  let ns = selectedNS.value;
  if (!ns) {
    const { load } = useNamespace();
    await load();
    ns = selectedNS.value;
  }
  if (!ns) return false;

  try {
    const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
    const tokenValue = useCookie<string | null>(CookieKeys.TOKEN).value;
    if (!tokenValue) return false;
    const installedMap = await hubAreAppsInNamespace(tokenValue, ns, [targetApp]);

    if (!installedMap[targetApp]) {
      await router.replace(`/${ns}/${app.address}/plans`);
      return true;
    }

    // Landing directly on an app's routes (as opposed to clicking its
    // dashboard tile, see handleAppClick) relies on the global auth
    // middleware to exchange for that app's own token mid-navigation --
    // but for apps that need one, fetching it proactively here first (same
    // as handleAppClick does) avoids a race where the destination page
    // renders before the middleware's async token exchange has resolved.
    if (app.address === 'atrace') {
      const { ensure } = useAtraceToken();
      await ensure(ns, tokenValue);
      await router.replace(`/${ns}/atrace/attendance/all`);
      return true;
    }
    if (app.address === 'contacts') {
      const { ensure } = useContactsToken();
      await ensure(ns, tokenValue);
    }
    await router.replace(`/${ns}/${app.address}`);
    return true;
  } catch (error) {
    logError('[deep-link] handlePendingTargetApp failed', error);
    return false;
  }
}

async function checkInstalledForVisibleApps() {
  if (!selectedNS.value) return;
  await ensureAppInstallStatus(selectedNS.value);
}

// Re-check when selected namespace changes outside of dropdown (e.g., deep link)
watch(() => selectedNS.value, () => {
  checkInstalledForVisibleApps();
});

type ProcessedMarkdownPost = HomeFeedPost & {
  categorySlug: string;
  dateISO: string;
};

type PublicationApiDoc = {
  slug?: string;
  category?: string;
  meta?: Record<string, string | string[] | undefined>;
  body?: string;
};

const { data: publicationDocsData, refresh: refreshPublicationDocs } = await useFetch<{ items: PublicationApiDoc[] }>('/api/publications/all', {
  query: { includeDraft: 'false' },
  default: () => ({ items: [] }),
});

const publicationAuthToken = useCookie<string | null>('token', { path: '/' });
const publicationLegacyToken = useCookie<string | null>('auth_token', { path: '/' });
const homePublicationsAuthRefreshDone = useState<boolean>('home-publications-auth-refresh-done', () => false);

onMounted(() => {
  const hasToken = !!String(publicationAuthToken.value || publicationLegacyToken.value || '').trim();
  if (!hasToken || homePublicationsAuthRefreshDone.value) return;
  homePublicationsAuthRefreshDone.value = true;
  refreshPublicationDocs().catch(() => {
    // Keep current payload if auth-aware refresh fails.
  });
});

function readTimeLabel(markdown: string): string {
  const mins = estimateReadTimeMinutes(markdown);
  return t('app.readTimeMinutes', { minutes: mins }) || `${mins} min read`;
}

function formatDate(dateISO: string): string {
  return formatPublishedDate(dateISO, locale.value);
}

function processMarkdownPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  const categoryLabel = (slug: string): string => {
    if (slug === 'whatsnew') return t('app.whatsNew') || "What's New";
    if (slug === 'news') return t('app.news') || 'News';
    if (slug === 'blog') return t('app.blog') || 'Blog';
    if (slug === 'academy') return t('app.academy') || 'Academy';
    if (slug === 'articles') return t('app.articles') || 'Articles';
    return t('app.articles') || 'Articles';
  };

  for (const doc of publicationDocsData.value?.items || []) {
    const meta = doc.meta || {};
    const body = String(doc.body || '');
    const categorySlug = String(doc.category || meta.category || '').toLowerCase();
    const slug = String(doc.slug || meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || !categorySlug) continue;

    const imgFromBody = extractFirstImage(body);
    const image = String(meta.og_image || meta.featured_image || imgFromBody?.src || '').trim();
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags.map((tag) => String(tag)) : [];
    const author = String(meta.author || 'Lota Team');
    const resolvedDate = dateISO || new Date().toISOString();

    posts.push({
      id: `${categorySlug}:${slug}`,
      href: `/${categorySlug}/${slug}`,
      category: categoryLabel(categorySlug),
      categorySlug,
      title,
      excerpt: String(meta.description || '').trim() || excerptFromMarkdown(body),
      preview: String(meta.description || '').trim() ? excerptFromMarkdown(body) : '',
      author,
      publishedAt: formatDate(resolvedDate),
      dateISO: resolvedDate,
      readTime: readTimeLabel(body),
      image,
      imageAlt,
      tags,
    });
  }

  return posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

const allProcessedPosts = computed(() => processMarkdownPosts());
const articleFeedPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug !== 'news' && post.categorySlug !== 'whatsnew'));
const newsFeedPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug === 'news'));
const HOME_NEWS_LIMIT = 10;
const homeNewsPosts = computed(() => {
  const newsLabel = t('app.news') || 'Новости';
  return newsFeedPosts.value.slice(0, HOME_NEWS_LIMIT).map((post) => ({ ...post, category: newsLabel }));
});
const articlesSearch = ref('');
const selectedArticleTag = ref('');
const homeNewsBrokenImages = ref<Record<string, boolean>>({});

function handleHomeNewsImageError(postId: string) {
  homeNewsBrokenImages.value[postId] = true;
}

const popularArticleTags = computed(() => {
  const counts = new Map<string, number>();
  for (const post of articleFeedPosts.value) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([tag]) => tag);
});
const filteredArticleFeedPosts = computed(() => {
  const q = articlesSearch.value.trim().toLowerCase();
  return articleFeedPosts.value.filter((post) => {
    const tagMatches = !selectedArticleTag.value || post.tags.includes(selectedArticleTag.value);
    if (!tagMatches) return false;
    if (!q) return true;
    const haystack = `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
});
const DESKTOP_INITIAL_FEED_LIMIT = 12;
const DESKTOP_FEED_STEP = 8;
const MOBILE_INITIAL_FEED_LIMIT = 5;
const MOBILE_FEED_STEP = 5;
const isMobileFeedViewport = ref(false);
const feedVisibleCount = ref(DESKTOP_INITIAL_FEED_LIMIT);
let mobileFeedMediaQuery: MediaQueryList | null = null;
const mainScrollContainer = ref<HTMLElement | null>(null);
const mobileFeedSentinel = ref<HTMLElement | null>(null);
let mobileFeedObserver: IntersectionObserver | null = null;
let mobileFeedAdvanceLocked = false;
const feedSectionRef = ref<HTMLElement | null>(null);
const isFeedSectionInView = ref(false);
let feedSectionObserver: IntersectionObserver | null = null;

function resolveScrollContainer(): HTMLElement | null {
  if (!process.client) return null;
  if (mainScrollContainer.value && document.contains(mainScrollContainer.value)) {
    return mainScrollContainer.value;
  }

  const found = document.querySelector<HTMLElement>('main.main-scroll');
  if (found) {
    mainScrollContainer.value = found;
  }
  return mainScrollContainer.value;
}

function scrollToTop() {
  if (!process.client) return;
  const container = resolveScrollContainer();

  const forceTop = () => {
    if (container) {
      container.scrollTop = 0;
    }
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  const getCurrentTop = () => {
    if (container) return container.scrollTop;
    return document.scrollingElement?.scrollTop
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || window.scrollY
      || 0;
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    forceTop();
    return;
  }

  const startTop = getCurrentTop();

  try {
    container?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: 'smooth' });
  } catch {
    forceTop();
    return;
  }

  // Fallback only if smooth scrolling did not start.
  setTimeout(() => {
    const currentTop = getCurrentTop();
    if (Math.abs(currentTop - startTop) < 2 && currentTop > 2) {
      forceTop();
    }
  }, 180);
}

function handleScrollTopTap(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  scrollToTop();
}

function handleNavigateToNews() {
  scrollToTop();
  router.push('/news');
}

function applyFeedViewport(matchesMobile: boolean) {
  isMobileFeedViewport.value = matchesMobile;
  const initialLimit = matchesMobile ? MOBILE_INITIAL_FEED_LIMIT : DESKTOP_INITIAL_FEED_LIMIT;
  feedVisibleCount.value = Math.min(initialLimit, maxFeedCards.value);
}

function onMobileFeedMediaChange(event: MediaQueryListEvent) {
  applyFeedViewport(event.matches);
}

const maxFeedCards = computed(() => filteredArticleFeedPosts.value.length);
const maxVisibleFeedCards = computed(() => {
  return maxFeedCards.value;
});
const visibleArticleFeedPosts = computed(() => {
  const limit = Math.min(maxVisibleFeedCards.value, feedVisibleCount.value);
  return filteredArticleFeedPosts.value.slice(0, limit);
});
const localizedVisibleArticleFeedPosts = computed(() => visibleArticleFeedPosts.value);
const canAutoLoadMoreFeedPosts = computed(() => {
  return visibleArticleFeedPosts.value.length < maxVisibleFeedCards.value;
});

function loadMoreFeedPosts() {
  const step = isMobileFeedViewport.value ? MOBILE_FEED_STEP : DESKTOP_FEED_STEP;
  feedVisibleCount.value = Math.min(maxVisibleFeedCards.value, feedVisibleCount.value + step);
}

function maybeLoadMoreMobileFeedByScroll() {
  if (!process.client || mobileFeedAdvanceLocked || !canAutoLoadMoreFeedPosts.value) {
    return;
  }

  const container = resolveScrollContainer();
  const scrollTop = container ? container.scrollTop : window.scrollY;
  const viewportHeight = container ? container.clientHeight : window.innerHeight;
  const scrollHeight = container ? container.scrollHeight : document.documentElement.scrollHeight;

  const scrollBottom = scrollTop + viewportHeight;
  const pageBottom = scrollHeight;
  if (scrollBottom < pageBottom - 220) return;

  mobileFeedAdvanceLocked = true;
  loadMoreFeedPosts();
  nextTick(() => {
    mobileFeedAdvanceLocked = false;
  });
}

function handleWindowScroll() {
  maybeLoadMoreMobileFeedByScroll();
}

function disconnectMobileFeedObserver() {
  if (mobileFeedObserver) {
    mobileFeedObserver.disconnect();
    mobileFeedObserver = null;
  }
}

function disconnectFeedSectionObserver() {
  if (feedSectionObserver) {
    feedSectionObserver.disconnect();
    feedSectionObserver = null;
  }
}

async function ensureFeedSectionObserver() {
  if (!process.client) {
    isFeedSectionInView.value = false;
    disconnectFeedSectionObserver();
    return;
  }

  await nextTick();
  const feedSectionEl = feedSectionRef.value;
  if (!feedSectionEl) {
    isFeedSectionInView.value = false;
    disconnectFeedSectionObserver();
    return;
  }

  if (!feedSectionObserver) {
    feedSectionObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        isFeedSectionInView.value = !!first?.isIntersecting;
      },
      {
        root: null,
        rootMargin: '-10% 0px -25% 0px',
        threshold: 0.08,
      }
    );
  }

  feedSectionObserver.disconnect();
  feedSectionObserver.observe(feedSectionEl);
}

async function ensureMobileFeedObserver() {
  if (!process.client || !canAutoLoadMoreFeedPosts.value) {
    disconnectMobileFeedObserver();
    return;
  }

  await nextTick();
  const sentinelEl = mobileFeedSentinel.value;
  if (!sentinelEl) return;

  if (!mobileFeedObserver) {
    mobileFeedObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || mobileFeedAdvanceLocked || !canAutoLoadMoreFeedPosts.value) return;

        mobileFeedAdvanceLocked = true;
        loadMoreFeedPosts();
        nextTick(() => {
          mobileFeedAdvanceLocked = false;
        });
      },
      {
        root: null,
        rootMargin: '140px 0px',
        threshold: 0.05,
      }
    );
  }

  mobileFeedObserver.disconnect();
  mobileFeedObserver.observe(sentinelEl);
}

const allWhatsNewPosts = computed(() => allProcessedPosts.value.filter((post) => post.categorySlug === 'whatsnew'));
const WHATS_NEW_SIDEBAR_LIMIT = 5;
const whatsNewSidebarPosts = computed(() => allWhatsNewPosts.value.slice(0, WHATS_NEW_SIDEBAR_LIMIT));

function handleOpenPost(post: HomeFeedPost) {
  if (!post.href) return;
  if (process.client) {
    window.location.assign(post.href);
    return;
  }
  router.push(post.href);
}

onMounted(() => {
  if (!process.client) return;
  mainScrollContainer.value = document.querySelector<HTMLElement>('main.main-scroll');
  mobileFeedMediaQuery = window.matchMedia('(max-width: 767px)');
  applyFeedViewport(mobileFeedMediaQuery.matches);
  mobileFeedMediaQuery.addEventListener('change', onMobileFeedMediaChange);
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  mainScrollContainer.value?.addEventListener('scroll', handleWindowScroll, { passive: true });
  ensureMobileFeedObserver();
  ensureFeedSectionObserver();
});

onBeforeUnmount(() => {
  if (mobileFeedMediaQuery) {
    mobileFeedMediaQuery.removeEventListener('change', onMobileFeedMediaChange);
    mobileFeedMediaQuery = null;
  }
  window.removeEventListener('scroll', handleWindowScroll);
  mainScrollContainer.value?.removeEventListener('scroll', handleWindowScroll);
  mainScrollContainer.value = null;
  disconnectMobileFeedObserver();
  disconnectFeedSectionObserver();
});

watch([isMobileFeedViewport, maxVisibleFeedCards, () => visibleArticleFeedPosts.value.length], () => {
  ensureMobileFeedObserver();
  maybeLoadMoreMobileFeedByScroll();
});

watch([isMobileFeedViewport, initialized, () => visibleArticleFeedPosts.value.length], () => {
  ensureFeedSectionObserver();
});

watch([articlesSearch, selectedArticleTag], () => {
  const initialLimit = isMobileFeedViewport.value ? MOBILE_INITIAL_FEED_LIMIT : DESKTOP_INITIAL_FEED_LIMIT;
  feedVisibleCount.value = Math.min(initialLimit, maxVisibleFeedCards.value);
});
</script>
<template>
  <div class="min-h-screen flex flex-col">
    <div class="pb-safe-or-4">
      <ClientOnly>
        <template #fallback>
          <div class="flex flex-col items-center text-center justify-center space-y-4 min-h-[50vh]">
            <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
            <USkeleton class="h-4 w-[250px]" />
            <USkeleton class="h-4 w-[200px]" />
          </div>
        </template>

        <div v-if="!initialized" class="flex flex-col items-center text-center justify-center space-y-4 min-h-[50vh]">
          <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
      </ClientOnly>

      <!-- Auto-rotating carousel: each slide owns its own light gradient.
           No mode="out-in" -- old and new slides crossfade simultaneously
           (default Transition behavior) so there's never an instant with
           neither mounted, which is what flashed the page's white
           background through earlier. A big decorative icon deliberately
           bleeds past the card edge, clipped by the frame's
           overflow-hidden. -->
      <div v-if="initialized" class="max-w-7xl mx-auto px-2 md:px-4 pt-6 md:pt-8 pb-12 md:pb-16">
        <div class="relative w-full h-[460px] sm:h-[460px] rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <Transition name="catalog-fade">
            <div
              :key="activeCatalogSlide"
              :class="['absolute inset-0 flex flex-col px-8 md:px-14 py-16 pt-8 bg-gradient-to-br', catalogSlides[activeCatalogSlide].gradient]"
            >
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <picture>
                    <source srcset="/assets/logo.webp" type="image/webp">
                    <img src="/assets/logo.png" alt="Logo" width="18" height="18" class="h-[18px] w-[18px]">
                  </picture>
                </div>
                <span class="text-sm font-semibold text-gray-700">{{ t('app.title') }}</span>
              </div>

              <div class="relative flex-1 flex items-center">
                <div class="relative z-10 max-w-sm">
                  <h2 :class="['text-2xl md:text-3xl font-bold leading-snug', catalogSlides[activeCatalogSlide].headlineColor]">
                    {{ t(catalogSlides[activeCatalogSlide].headlineKey) }}
                  </h2>
                  <p :class="['mt-3 text-lg leading-relaxed', catalogSlides[activeCatalogSlide].descColor]">
                    {{ t(catalogSlides[activeCatalogSlide].descKey) }}
                  </p>
                </div>

                <!-- Accent glow behind the icon, in the slide's own hue, so
                     the icon doesn't just float on the flat card gradient. -->
                <div
                  class="absolute -right-16 -bottom-16 sm:-right-10 sm:-bottom-10 md:-right-14 md:-bottom-14 w-96 h-96 sm:w-[34rem] sm:h-[34rem] md:w-[42rem] md:h-[42rem] rounded-full pointer-events-none"
                  :style="{ background: `radial-gradient(circle, ${catalogSlides[activeCatalogSlide].accentColor} 0%, transparent 80%)` }"
                />

                <UIcon
                  :name="catalogSlides[activeCatalogSlide].icon"
                  :class="['absolute -right-10 -bottom-14 sm:-right-20 sm:-bottom-32 md:-right-28 md:-bottom-36 w-56 h-56 sm:w-[23rem] sm:h-[23rem] md:w-[29rem] md:h-[29rem] pointer-events-none opacity-60', catalogSlides[activeCatalogSlide].iconColor]"
                />
              </div>

              <button
                type="button"
                class="relative z-10 self-start -mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
                @click="handleGoToCatalog"
              >
                {{ t('app.goToCatalogCta') || 'Перейти в каталог' }}
                <UIcon name="lucide:arrow-right" class="w-4 h-4" />
              </button>
            </div>
          </Transition>
        </div>

        <div class="mt-4 flex items-center gap-1.5">
          <button
            v-for="(slide, i) in catalogSlides"
            :key="slide.key"
            type="button"
            class="h-1.5 rounded-full transition-all"
            :class="i === activeCatalogSlide ? 'w-6 bg-emerald-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700'"
            :aria-label="t(slide.headlineKey)"
            @click="activeCatalogSlide = i"
          />
        </div>
      </div>

      <!-- Catalog, explained -- and a second chance to click through. Same
           width/left-aligned rhythm as the business services section below,
           not a separate centered block. A bottom border + matching
           vertical padding is the section divider -- no divider of its own
           otherwise, this ran straight into "Business services" below it. -->
      <div v-if="initialized" class="max-w-7xl mx-auto px-2 md:px-4 py-10 md:py-14 border-b border-gray-100 dark:border-gray-800">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div
              v-for="feature in catalogFeatures"
              :key="feature.key"
              class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-7"
            >
              <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 mb-4">
                <UIcon :name="feature.icon" class="w-8 h-8" />
              </div>
              <p class="text-xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">{{ t(feature.titleKey) }}</p>
              <p class="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ t(feature.descKey) }}</p>
            </div>
          </div>

          <div>
            <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 mb-5">
              <UIcon name="lucide:store" class="w-7 h-7" />
            </div>
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{{ t('app.catalogCardTitle') || 'Каталог' }}</h2>
            <p class="mt-3 text-base text-gray-600 dark:text-gray-300 max-w-md">
              {{ t('app.catalogExplainer') || 'Каталог — удобный способ находить и выбирать бизнесы на lota: смотрите публичные витрины, меню и цены, оформляйте заказы и записывайтесь на услуги — без звонков и лишних действий.' }}
            </p>
            <button
              type="button"
              class="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-teal-600 transition-all"
              @click="handleGoToCatalog"
            >
              {{ t('app.open') || 'Открыть' }}
              <UIcon name="lucide:arrow-right" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Business services -->
      <div v-if="initialized" class="max-w-7xl mx-auto px-2 md:px-4 pt-10 md:pt-14 pb-10 md:pb-14 space-y-6 md:space-y-10 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.businessServicesHeading') || 'Сервисы lota для бизнеса' }}</h3>
          <p class="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">{{ t('app.businessServicesHint') || 'Приложения для управления бизнесом на платформе lota' }}</p>
        </div>

        <div v-if="activeApps.length">
          <h3 class="text-lg font-medium mb-4">{{ t('app.installedHead') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
            <div v-for="app in activeApps" :key="app.bundle" class="h-full">
              <AppCard v-bind="toCard(app)" />
            </div>
          </div>
        </div>

        <div v-if="possibleApps.length">
          <h3 class="text-lg font-medium mb-4">{{ t('app.availableHead') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
            <div v-for="app in possibleApps" :key="app.bundle" class="h-full">
              <AppCard v-bind="toCard(app)" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="initialized" ref="feedSectionRef" class="max-w-7xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300">
        <!-- News section above the article feed -->
        <div v-if="homeNewsPosts.length > 0" class="mb-8">
          <div class="mb-4 flex items-center gap-2">
            <UIcon name="lucide:radio" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.news') || 'Новости' }}</h2>
          </div>

          <!-- empty state -->
          <div v-if="homeNewsPosts.length === 0" class="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-blue-100 bg-blue-50/40 py-12 text-center dark:border-gray-700 dark:bg-gray-800/40">
            <UIcon name="lucide:radio" class="h-10 w-10 text-blue-200 dark:text-gray-600" />
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('app.noNewsYet') || 'Новостей пока нет' }}</p>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            <article
              v-for="(post, idx) in homeNewsPosts"
              :key="post.id"
              class="overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer flex flex-col"
              role="button"
              tabindex="0"
              @click="handleOpenPost(post)"
              @keydown.enter="handleOpenPost(post)"
            >
              <img
                v-if="post.image && !homeNewsBrokenImages[post.id]"
                :src="post.image"
                :alt="post.imageAlt"
                class="h-56 w-full object-cover"
                :loading="idx === 0 ? 'eager' : 'lazy'"
                decoding="async"
                width="1200"
                height="630"
                @error="handleHomeNewsImageError(post.id)"
              />
              <div
                v-else
                class="h-56 w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-gray-700 dark:to-gray-800 dark:text-gray-500 p-4 text-center"
              >
                <div class="flex flex-col items-center gap-2">
                  <UIcon name="lucide:image-off" class="h-8 w-8" />
                  <p class="text-xs line-clamp-2">{{ post.imageAlt }}</p>
                </div>
              </div>
              <div class="p-5 flex flex-col flex-1">
                <div class="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                    {{ post.category }}
                  </span>
                  <span>{{ post.publishedAt }}</span>
                </div>
                <h3 class="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{{ post.title }}</h3>
                <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300 line-clamp-3">{{ post.excerpt }}</p>
                <UButton
                  :to="post.href?.startsWith('/') ? post.href : `/${post.href}`"
                  variant="ghost"
                  size="sm"
                  class="mt-4 w-fit"
                >
                  {{ t('app.read') || 'Читать' }}
                </UButton>
              </div>
            </article>

            <!-- Odd count: compact button filling the empty grid slot -->
            <button
              v-if="homeNewsPosts.length % 2 !== 0"
              type="button"
              class="overflow-hidden rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[200px] p-6"
              @click="handleNavigateToNews"
            >
              <UIcon name="lucide:arrow-right" class="h-8 w-8 text-blue-400 dark:text-blue-500" />
              <span class="text-sm font-medium text-blue-600 dark:text-blue-300">{{ t('app.allNews') || 'Все новости' }}</span>
            </button>
          </div>

          <!-- Even count: full-width card below the grid -->
          <button
            v-if="homeNewsPosts.length > 0 && homeNewsPosts.length % 2 === 0"
            type="button"
            class="mt-4 w-full rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-all duration-200 cursor-pointer flex items-center justify-center gap-3 py-4 px-6"
            @click="handleNavigateToNews"
          >
            <UIcon name="lucide:arrow-right" class="h-5 w-5 text-blue-400 dark:text-blue-500" />
            <span class="text-sm font-medium text-blue-600 dark:text-blue-300">{{ t('app.allNews') || 'Все новости' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
          <section v-if="localizedVisibleArticleFeedPosts.length > 0">
            <div class="mb-5 flex items-center gap-2">
              <UIcon name="lucide:newspaper" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.feed') || 'Feed' }}</h2>
            </div>

            <HomePostsFeed :posts="localizedVisibleArticleFeedPosts" @open="handleOpenPost" />

            <div
              v-if="canAutoLoadMoreFeedPosts"
              ref="mobileFeedSentinel"
              class="h-px w-full"
              aria-hidden="true"
            />
          </section>

          <FeedSidebarWidget
            v-if="popularArticleTags.length > 0 || whatsNewSidebarPosts.length > 0"
            :articles-search="articlesSearch"
            :selected-tag="selectedArticleTag"
            :popular-tags="popularArticleTags"
            :whats-new-posts="whatsNewSidebarPosts"
            :is-mobile-viewport="isMobileFeedViewport"
            :is-feed-section-in-view="isFeedSectionInView"
            @update:articles-search="articlesSearch = $event"
            @update:selected-tag="selectedArticleTag = $event"
            @open="handleOpenPost"
          />
        </div>
      </div>

    </div>

    <div class="m-4 mt-auto">
      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
.mobile-sheet-enter-active,
.mobile-sheet-leave-active {
  transition: all 0.3s ease;
}

.mobile-sheet-enter-from,
.mobile-sheet-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.mobile-sheet-enter-to,
.mobile-sheet-leave-from {
  opacity: 1;
  max-height: 600px;
}

.catalog-fade-enter-active,
.catalog-fade-leave-active {
  transition: opacity 0.15s ease;
}

.catalog-fade-enter-from,
.catalog-fade-leave-to {
  opacity: 0;
}
</style>
