<script setup lang="ts">
definePageMeta({ layout: 'full' });

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import { useAppInstallStatus } from '@/composables/useAppInstallStatus';
import type { HomeFeedPost } from '@/components/ui/HomePostsFeed.vue';
import AppCard from '@/components/ui/AppCard.vue';
import PromoVideoDeck from '@/components/ui/PromoVideoDeck.vue';
import LegalLinks from '@/components/ui/LegalLinks.vue';
import FeedSidebarWidget from '@/components/ui/FeedSidebarWidget.vue';
import { extractFirstImage, excerptFromMarkdown, estimateReadTimeMinutes, formatPublishedDate } from '@/utils/markdown';

// Composables
const { user, isLoggedIn, initialized, justLoggedOut, fetchUser, login } = useAuth();
const { selected: selectedNS, all: allNamespaces } = useNamespace();
// The bare "/" route never runs the namespace middleware, so selectedNS can
// still be empty for a beat after hydration while useNamespace's own watcher
// resolves it. Fall back to the first known namespace so the per-namespace
// storefront links on the app cards aren't hidden in that window.
const dashboardNs = computed(() => selectedNS.value || allNamespaces.value?.[0] || '');
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

// Promo video deck. Order = default deck order: general, A-Trace, then the rest.
const promoSlides = [
  { id: 'lota', icon: 'lucide:layout-grid', src: '/media/brag.mp4', poster: '/assets/brag-poster.jpg', titleKey: 'app.promoVideoTitle', descKey: 'app.promoVideoDesc' },
  { id: 'atrace', icon: 'lucide:qr-code', src: '/media/atrace.mp4', poster: '/assets/atrace-poster.jpg', titleKey: 'app.promoSlideAtraceTitle', descKey: 'app.promoSlideAtraceDesc' },
  { id: 'coffee', icon: 'lucide:coffee', src: '/media/coffee.mp4', poster: '/assets/coffee-poster.jpg', titleKey: 'app.promoSlideCoffeeTitle', descKey: 'app.promoSlideCoffeeDesc' },
  { id: 'contacts', icon: 'lucide:contact', src: '/media/contacts.mp4', poster: '/assets/contacts-poster.jpg', titleKey: 'app.promoSlideContactsTitle', descKey: 'app.promoSlideContactsDesc' },
  { id: 'orders', icon: 'lucide:receipt-text', src: '/media/orders.mp4', poster: '/assets/orders-poster.jpg', titleKey: 'app.promoSlideOrdersTitle', descKey: 'app.promoSlideOrdersDesc' },
  { id: 'orders-issues', icon: 'lucide:truck', src: '/media/orders-issues.mp4', poster: '/assets/orders-issues-poster.jpg', titleKey: 'app.promoSlideOrdersIssuesTitle', descKey: 'app.promoSlideOrdersIssuesDesc' },
  { id: 'goods', icon: 'lucide:package', src: '/media/goods.mp4', poster: '/assets/goods-poster.jpg', titleKey: 'app.promoSlideGoodsTitle', descKey: 'app.promoSlideGoodsDesc' },
  { id: 'plans', icon: 'lucide:calendar-check', src: '/media/plans.mp4', poster: '/assets/plans-poster.jpg', titleKey: 'app.promoSlidePlansTitle', descKey: 'app.promoSlidePlansDesc' },
  { id: 'referral', icon: 'lucide:gift', src: '/media/referral.mp4', poster: '/assets/referral-poster.jpg', titleKey: 'app.promoSlideReferralTitle', descKey: 'app.promoSlideReferralDesc' },
] as const;
const activePromo = ref(0);

const catalogFeatures = [
  { key: 'businesses', icon: 'lucide:store', titleKey: 'app.catalogFeatureBusinessesTitle', descKey: 'app.catalogFeatureBusinessesDesc' },
  { key: 'ratings', icon: 'lucide:star', titleKey: 'app.catalogFeatureRatingsTitle', descKey: 'app.catalogFeatureRatingsDesc' },
  { key: 'services', icon: 'lucide:briefcase', titleKey: 'app.catalogFeatureServicesTitle', descKey: 'app.catalogFeatureServicesDesc' },
  { key: 'more', icon: 'lucide:sparkles', titleKey: 'app.catalogFeatureMoreTitle', descKey: 'app.catalogFeatureMoreDesc' },
] as const;

// Scroll reveal: elements fade up once as they enter the viewport
// (IntersectionObserver, transform/opacity only; see .reveal in <style>).
const vReveal = {
  mounted(el: HTMLElement, binding: { value?: number }) {
    el.classList.add('reveal');
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('reveal-in');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    (el as HTMLElement & { __revealIO?: IntersectionObserver }).__revealIO = io;
  },
  unmounted(el: HTMLElement & { __revealIO?: IntersectionObserver }) {
    el.__revealIO?.disconnect();
  },
};

// Marketing tiles for the logged-out "for business" bento (logged-in staff
// see their real app dashboard instead). span = columns of the 6-col grid.
const bizTiles = [
  { id: 'menu', name: 'Orders', icon: 'lucide:receipt-text', descKey: 'app.homeProdOrders', span: 'md:col-span-4', big: true },
  { id: 'atrace', name: 'A-Trace', icon: 'lucide:qr-code', descKey: 'app.homeProdAtrace', span: 'md:col-span-2', big: false },
  { id: 'contacts', name: 'Contacts', icon: 'lucide:contact', descKey: 'app.homeProdContacts', span: 'md:col-span-2', big: false },
  { id: 'goods', name: 'Goods', icon: 'lucide:package', descKey: 'app.homeProdGoods', span: 'md:col-span-2', big: false },
  { id: 'issues', name: 'Issues', icon: 'lucide:clipboard-check', descKey: 'app.homeProdIssues', span: 'md:col-span-2', big: false },
  { id: 'plans', name: 'Plans', icon: 'lucide:calendar-check', descKey: 'app.homeProdPlans', span: 'md:col-span-4', big: true },
] as const;
const customerSteps = [
  { n: '01', titleKey: 'app.homeCStep1Title', descKey: 'app.homeCStep1Desc', icon: 'lucide:search' },
  { n: '02', titleKey: 'app.homeCStep2Title', descKey: 'app.homeCStep2Desc', icon: 'lucide:shopping-bag' },
  { n: '03', titleKey: 'app.homeCStep3Title', descKey: 'app.homeCStep3Desc', icon: 'lucide:heart' },
] as const;
const startSteps = [
  { n: '01', titleKey: 'app.homeStep1Title', descKey: 'app.homeStep1Desc', icon: 'lucide:log-in' },
  { n: '02', titleKey: 'app.homeStep2Title', descKey: 'app.homeStep2Desc', icon: 'lucide:layout-grid' },
  { n: '03', titleKey: 'app.homeStep3Title', descKey: 'app.homeStep3Desc', icon: 'lucide:users' },
] as const;

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
const siteUrl = (config.public.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');

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

// Apps with a public, customer-facing page reachable straight from the
// dashboard tile (opens in a new tab — see AppCard's storefront button).
const STOREFRONT_APPS: Record<string, { path: (ns: string) => string; labelKey: string; fallback: string }> = {
  menu: { path: (ns) => `/to/${ns}/menu`, labelKey: 'app.externalStorefront', fallback: 'Витрина' },
  contacts: { path: (ns) => `/to/${ns}/memberships`, labelKey: 'app.externalMemberships', fallback: 'Абонементы' },
  plans: { path: (ns) => `/to/${ns}/plans`, labelKey: 'app.externalBookingPage', fallback: 'Страница записи' },
};

function toCard(app: AppConfig) {
  const routePath = appRoutePath(app);
  const ns = dashboardNs.value;
  const sf = STOREFRONT_APPS[app.address];
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
    storefrontTo: sf && ns ? sf.path(ns) : undefined,
    storefrontLabel: sf ? (t(sf.labelKey) || sf.fallback) : undefined,
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

      <!-- HERO: introduces lota and splits visitors into two paths --
           customers (patrons) go to the Catalog, business staff to the Hub. -->
      <section v-if="initialized" class="relative -mt-20 overflow-hidden">
        <div class="hero-mesh pointer-events-none absolute inset-0" aria-hidden="true" />
        <div class="relative max-w-7xl mx-auto px-4 pt-28 sm:pt-32 md:pt-40 pb-10 md:pb-14 text-center">
          <span v-reveal class="eyebrow">{{ t('app.homeHeroEyebrow') }}</span>
          <h1 v-reveal="80" class="mt-5 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-gray-900 dark:text-white">
            {{ t('app.homeHeroTitleA') }}<br>
            <span class="grad-text">{{ t('app.homeHeroTitleB') }}</span>
          </h1>
          <p v-reveal="160" class="mt-4 mx-auto max-w-2xl text-base md:text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            {{ t('app.homeHeroLead') }}
          </p>

          <!-- Split hero: two halves of one surface. Hovering a half lets it
               grow; the lota mark sits on the seam. -->
          <div v-reveal="240" class="mt-8 md:mt-12 text-left">
            <div class="bezel">
              <div class="split relative flex flex-col md:flex-row overflow-hidden" style="border-radius: calc(2rem - 0.4rem)">
                <div class="split-panel panel-client group relative flex min-h-[19rem] cursor-pointer flex-col overflow-hidden p-6 md:min-h-[28rem] md:p-10" role="button" tabindex="0" @click="handleGoToCatalog" @keydown.enter="handleGoToCatalog">
                  <div class="relative z-10 flex items-start justify-between gap-4">
                    <span class="eyebrow">{{ t('app.homePathClientTag') }}</span>
                    <div class="icon-tile"><UIcon name="lucide:store" class="w-6 h-6" /></div>
                  </div>
                  <h2 class="relative z-10 mt-8 max-w-[21rem] text-2xl md:text-3xl font-bold leading-snug text-gray-900 dark:text-white">{{ t('app.homePathClientTitle') }}</h2>
                  <p class="relative z-10 mt-3 max-w-[21rem] text-sm md:text-base leading-6 text-gray-600 dark:text-gray-300">{{ t('app.homePathClientDesc') }}</p>
                  <div class="relative z-10 mt-auto pt-8">
                    <span class="cta-pill cta-pill--ghost">
                      {{ t('app.goToCatalogCta') }}
                      <span class="cta-arrow"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
                    </span>
                  </div>
                  <!-- decorative floating chips -->
                  <div class="chip float-a" style="right: 15%; top: 30%"><UIcon name="lucide:star" class="h-4 w-4 text-amber-500" />4.9</div>
                  <div class="chip float-b" style="right: 12%; top: 46%"><UIcon name="lucide:heart" class="h-4 w-4 text-rose-500" />128</div>
                  <div class="chip float-c" style="right: 16%; top: 62%"><UIcon name="lucide:gift" class="h-4 w-4 text-emerald-600" />+140</div>
                </div>

                <div class="seam-slot pointer-events-none" aria-hidden="true">
                  <div class="seam-badge">
                    <picture>
                      <source srcset="/assets/logo.webp" type="image/webp">
                      <img src="/assets/logo.png" alt="" width="28" height="28" class="h-7 w-7">
                    </picture>
                  </div>
                </div>

                <div class="split-panel panel-biz group relative flex min-h-[19rem] cursor-pointer flex-col overflow-hidden p-6 md:min-h-[28rem] md:p-10" role="button" tabindex="0" @click="handleGoToHub" @keydown.enter="handleGoToHub">
                  <div class="relative z-10 flex items-start justify-between gap-4">
                    <span class="eyebrow">{{ t('app.homePathBizTag') }}</span>
                    <div class="icon-tile"><UIcon name="lucide:briefcase" class="w-6 h-6" /></div>
                  </div>
                  <h2 class="relative z-10 mt-8 max-w-[21rem] text-2xl md:text-3xl font-bold leading-snug text-gray-900 dark:text-white">{{ t('app.homePathBizTitle') }}</h2>
                  <p class="relative z-10 mt-3 max-w-[21rem] text-sm md:text-base leading-6 text-gray-600 dark:text-gray-300">{{ t('app.homePathBizDesc') }}</p>
                  <div class="relative z-10 mt-auto pt-8">
                    <span class="cta-pill cta-pill--primary">
                      <svg v-if="!isLoggedIn" class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                      {{ isLoggedIn ? (t('app.hubRibbonCtaLoggedIn') || 'Рабочее пространство') : (t('app.hubRibbonCta') || 'Войти через Google') }}
                      <span class="cta-arrow"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
                    </span>
                  </div>
                  <div class="chip float-b" style="right: 9%; top: 34%"><UIcon name="lucide:receipt-text" class="h-4 w-4 text-blue-600" />#128</div>
                  <div class="chip float-c" style="right: 3%; top: 50%"><UIcon name="lucide:qr-code" class="h-4 w-4 text-blue-600" />08:58</div>
                  <div class="chip float-a" style="right: 14%; top: 66%"><UIcon name="lucide:circle-check" class="h-4 w-4 text-emerald-600" />OK</div>
                </div>

              </div>
            </div>
          </div>

          <div v-reveal="440" class="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
            <span v-for="k in ['homeFact1', 'homeFact2', 'homeFact3']" :key="k" class="inline-flex items-center gap-1.5">
              <UIcon name="lucide:check" class="w-4 h-4 text-emerald-600" />
              {{ t('app.' + k) }}
            </span>
          </div>
          <LegalLinks v-if="!isLoggedIn" context="login" align="center" class="mt-4" />
        </div>
      </section>

      <!-- MEET LOTA: the video deck + per-video copy -->
      <section v-if="initialized" class="max-w-7xl mx-auto px-4 py-14 md:py-24">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div v-reveal class="lg:pt-6">
            <span class="eyebrow">{{ t('app.homeSeeEyebrow') }}</span>
            <div class="mt-6 grid">
              <div
                v-for="(slide, i) in promoSlides"
                :key="slide.id"
                class="col-start-1 row-start-1 transition-opacity duration-300"
                :class="i === activePromo ? 'opacity-100' : 'pointer-events-none opacity-0'"
                :aria-hidden="i !== activePromo"
              >
                <div class="icon-tile mb-6"><UIcon :name="slide.icon" class="w-6 h-6" /></div>
                <h2 class="text-3xl md:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">{{ t(slide.titleKey) }}</h2>
                <p class="mt-4 max-w-lg text-base md:text-lg leading-7 text-gray-600 dark:text-gray-300">{{ t(slide.descKey) }}</p>
              </div>
            </div>
            <button type="button" class="cta-pill cta-pill--primary mt-8" @click="handleGoToHub">
              {{ isLoggedIn ? (t('app.hubRibbonCtaLoggedIn') || 'Рабочее пространство') : t('app.promoVideoCta') }}
              <span class="cta-arrow"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
            </button>
            <div class="mt-8 flex items-center gap-1.5">
              <button
                v-for="(slide, i) in promoSlides"
                :key="slide.id"
                type="button"
                class="h-1.5 rounded-full transition-all duration-500"
                :class="i === activePromo ? 'w-6 bg-emerald-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700'"
                :aria-label="t(slide.titleKey)"
                @click="activePromo = i"
              />
            </div>
          </div>
          <div v-reveal="160">
            <PromoVideoDeck
              v-model:active="activePromo"
              :slides="promoSlides as any"
              :width="608"
              :height="1080"
              :sound-on-label="t('app.promoVideoSoundOn')"
              :sound-off-label="t('app.promoVideoSoundOff')"
            />
          </div>
        </div>
      </section>

      <!-- CATALOG (about 60% of the page): what it is, how it works, the
           customer profile. Business content follows, more compactly. -->
      <section v-if="initialized" class="max-w-7xl mx-auto px-4 py-14 md:py-24">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div v-reveal>
            <span class="eyebrow">{{ t('app.homeCustEyebrow') }}</span>
            <h2 class="mt-5 text-3xl md:text-5xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">{{ t('app.homeCustTitle') }}</h2>
            <p class="mt-4 max-w-lg text-base md:text-lg leading-7 text-gray-600 dark:text-gray-300">{{ t('app.catalogExplainer') }}</p>
            <button type="button" class="cta-pill cta-pill--primary mt-8" @click="handleGoToCatalog">
              {{ t('app.goToCatalogCta') }}
              <span class="cta-arrow"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            <div v-for="(feature, i) in catalogFeatures" :key="feature.key" v-reveal="i * 100">
              <div class="bezel h-full">
                <div class="bezel-core h-full p-6">
                  <div class="icon-tile"><UIcon :name="feature.icon" class="w-6 h-6" /></div>
                  <p class="mt-6 text-lg font-bold leading-snug text-gray-900 dark:text-white">{{ t(feature.titleKey) }}</p>
                  <p class="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ t(feature.descKey) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="initialized" class="max-w-7xl mx-auto px-4 py-14 md:py-24">
        <div v-reveal class="mx-auto mb-10 md:mb-14 max-w-3xl text-center">
          <span class="eyebrow">{{ t('app.homeCustHowEyebrow') }}</span>
          <h2 class="mt-5 text-3xl md:text-5xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">{{ t('app.homeCustHowTitle') }}</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          <div v-for="(step, i) in customerSteps" :key="step.n" v-reveal="i * 110">
            <div class="bezel h-full">
              <div class="bezel-core h-full p-6 md:p-8">
                <div class="flex items-center justify-between">
                  <span class="text-4xl font-extrabold tracking-tight grad-text">{{ step.n }}</span>
                  <div class="icon-tile"><UIcon :name="step.icon" class="w-6 h-6" /></div>
                </div>
                <h3 class="mt-8 text-xl font-bold text-gray-900 dark:text-white">{{ t(step.titleKey) }}</h3>
                <p class="mt-2 text-base leading-7 text-gray-600 dark:text-gray-300">{{ t(step.descKey) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-reveal class="mt-4 md:mt-5">
          <div class="bezel">
            <div
              class="relative flex flex-col gap-6 overflow-hidden p-6 text-white md:flex-row md:items-center md:justify-between md:p-10"
              style="border-radius: calc(2rem - 0.4rem); background-image: linear-gradient(135deg, #2563eb, #10b981); box-shadow: 0 18px 40px -20px rgba(37, 99, 235, 0.6)"
            >
              <UIcon name="lucide:heart" class="pointer-events-none absolute -right-6 -bottom-12 h-56 w-56" style="opacity: 0.12" />
              <div class="relative max-w-xl">
                <h3 class="text-2xl md:text-3xl font-bold tracking-tight">{{ t('app.homeProfileTitle') }}</h3>
                <p class="mt-3 text-base leading-7" style="opacity: 0.92">{{ t('app.homeProfileDesc') }}</p>
              </div>
              <button type="button" class="cta-pill relative flex-shrink-0 self-start md:self-auto" style="background: #fff; color: #0f172a" @click="handleGoToCatalog">
                {{ t('app.goToCatalogCta') }}
                <span class="cta-arrow" style="background: rgba(15, 23, 42, 0.08)"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- FOR BUSINESS (about 40%): staff see their real app dashboard;
           everyone else a compact grid of the products leading to the Hub. -->
      <section v-if="initialized" class="max-w-7xl mx-auto px-4 py-14 md:py-20">
        <div v-reveal class="mb-8 md:mb-10 max-w-3xl">
          <span class="eyebrow">{{ t('app.homeBizEyebrow') }}</span>
          <h2 class="mt-5 text-2xl md:text-4xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">{{ t('app.homeBizTitle') }}</h2>
          <p class="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">{{ t('app.homeBizDesc') }}</p>
        </div>

        <div v-if="isLoggedIn && (activeApps.length || possibleApps.length)" class="space-y-6 md:space-y-10">
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

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
          <div v-for="(tile, i) in bizTiles" :key="tile.id" v-reveal="(i % 3) * 100">
            <div class="bezel bezel-hover group h-full cursor-pointer" role="button" tabindex="0" @click="handleGoToHub" @keydown.enter="handleGoToHub">
              <div class="bezel-core relative flex h-full min-h-[11rem] flex-col overflow-hidden p-5 md:p-6">
                <UIcon :name="tile.icon" class="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 text-gray-900 dark:text-white" style="opacity: 0.045" />
                <div class="flex items-center gap-3">
                  <div class="icon-tile"><UIcon :name="tile.icon" class="w-6 h-6" /></div>
                  <h3 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{{ tile.name }}</h3>
                </div>
                <p class="mt-4 text-sm md:text-base leading-6 text-gray-600 dark:text-gray-300">{{ t(tile.descKey) }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-reveal class="mt-4 md:mt-5">
          <div class="bezel">
            <div class="bezel-core flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
              <div class="max-w-2xl">
                <h3 class="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{{ t('app.homeStartTitle') }}</h3>
                <ol class="mt-3 flex flex-col gap-1.5 text-sm md:text-base text-gray-600 dark:text-gray-300">
                  <li v-for="step in startSteps" :key="step.n" class="flex items-baseline gap-2">
                    <span class="grad-text font-bold">{{ step.n }}</span>
                    <span><b class="font-semibold text-gray-900 dark:text-white">{{ t(step.titleKey) }}.</b> {{ t(step.descKey) }}</span>
                  </li>
                </ol>
              </div>
              <div class="flex flex-shrink-0 flex-col items-start gap-3">
                <button type="button" class="cta-pill cta-pill--primary" @click="handleGoToHub">
                  {{ isLoggedIn ? (t('app.hubRibbonCtaLoggedIn') || 'Рабочее пространство') : t('app.promoVideoCta') }}
                  <span class="cta-arrow"><UIcon name="lucide:arrow-up-right" class="w-4 h-4" /></span>
                </button>
                <span class="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <UIcon name="lucide:gift" class="w-4 h-4 text-emerald-600" />
                  {{ t('app.promoSlideReferralTitle') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

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

/* ---- Home redesign ---- */
.hero-mesh {
  background:
    radial-gradient(55% 45% at 12% 0%, rgba(37, 99, 235, 0.14), transparent 70%),
    radial-gradient(45% 40% at 92% 6%, rgba(16, 185, 129, 0.16), transparent 70%),
    radial-gradient(40% 35% at 50% 100%, rgba(99, 102, 241, 0.08), transparent 70%);
  -webkit-mask-image: linear-gradient(#000 65%, transparent);
  mask-image: linear-gradient(#000 65%, transparent);
}
:global(.dark) .hero-mesh {
  background:
    radial-gradient(55% 45% at 12% 0%, rgba(37, 99, 235, 0.22), transparent 70%),
    radial-gradient(45% 40% at 92% 6%, rgba(16, 185, 129, 0.18), transparent 70%);
}

.grad-text {
  background-image: linear-gradient(90deg, #2563eb, #10b981);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 9999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #475569;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
}
:global(.dark) .eyebrow {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.icon-tile {
  display: flex;
  height: 3.25rem;
  width: 3.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  color: #fff;
  background-image: linear-gradient(135deg, #2563eb, #10b981);
  box-shadow: 0 8px 20px -8px rgba(37, 99, 235, 0.55);
}

/* Double bezel: a hairline outer tray holding a lighter inner core. */
.bezel {
  border-radius: 2rem;
  padding: 0.4rem;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  transition: transform 0.7s cubic-bezier(0.32, 0.72, 0, 1);
}
.bezel-core {
  border-radius: calc(2rem - 0.4rem);
  background: #fff;
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 18px 40px -20px rgba(15, 23, 42, 0.18);
}
.bezel-hover:hover {
  transform: translateY(-4px);
}
:global(.dark) .bezel {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
:global(.dark) .bezel-core {
  background: #111827;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
}

/* Pill CTA with the arrow in its own nested circle. */
.cta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 9999px;
  padding: 0.45rem 0.45rem 0.45rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  transition: transform 0.6s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}
.cta-pill:active {
  transform: scale(0.98);
}
.cta-pill--primary {
  color: #fff;
  background-image: linear-gradient(90deg, #2563eb, #10b981);
  box-shadow: 0 12px 28px -12px rgba(37, 99, 235, 0.65);
}
.cta-pill--ghost {
  color: #0f172a;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12);
}
:global(.dark) .cta-pill--ghost {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
}
.cta-arrow {
  display: flex;
  height: 2.25rem;
  width: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.22);
  transition: transform 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}
.cta-pill--ghost .cta-arrow,
.cta-arrow--ghost {
  background: rgba(15, 23, 42, 0.06);
  color: inherit;
}
:global(.dark) .cta-pill--ghost .cta-arrow,
:global(.dark) .cta-arrow--ghost {
  background: rgba(255, 255, 255, 0.1);
}
.cta-pill:hover .cta-arrow,
.group:hover .cta-arrow {
  transform: translate(2px, -1px) scale(1.06);
}

/* Scroll reveal (transform/opacity only). */
.reveal {
  opacity: 0;
  transform: translate3d(0, 28px, 0);
  transition:
    opacity 0.9s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.9s cubic-bezier(0.32, 0.72, 0, 1);
}
.reveal-in {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* Split hero */
.split-panel {
  transition: flex-grow 0.8s cubic-bezier(0.32, 0.72, 0, 1);
}
@media (min-width: 768px) {
  .split-panel { flex: 1 1 0; }
  .split:hover .split-panel { flex-grow: 0.86; }
  .split .split-panel:hover { flex-grow: 1.28; }
}
.panel-client {
  background-image: linear-gradient(155deg, #eff6ff 0%, #e0e7ff 100%);
}
.panel-biz {
  background-image: linear-gradient(155deg, #ecfdf5 0%, #cffafe 100%);
}
:global(.dark) .panel-client { background-image: linear-gradient(155deg, #1e293b 0%, #1e1b4b 100%); }
:global(.dark) .panel-biz { background-image: linear-gradient(155deg, #0f2a26 0%, #0c3040 100%); }

.seam-slot {
  position: relative;
  z-index: 5;
  display: none;
  width: 0;
  flex: none;
}
@media (min-width: 768px) {
  .seam-slot { display: block; }
}
.seam-badge {
  position: absolute;
  top: 50%;
  left: 0;
  display: flex;
  height: 3.5rem;
  width: 3.5rem;
  margin: -1.75rem 0 0 -1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #fff;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.55), 0 10px 24px -8px rgba(15, 23, 42, 0.25);
}
:global(.dark) .seam-badge { background: #111827; box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.06), 0 10px 24px -8px rgba(0, 0, 0, 0.5); }

.chip {
  position: absolute;
  z-index: 1;
  display: none;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  padding: 0.4rem 0.8rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 20px -8px rgba(15, 23, 42, 0.25), inset 0 0 0 1px rgba(15, 23, 42, 0.05);
}
@media (min-width: 768px) {
  .chip { display: inline-flex; }
}
:global(.dark) .chip { color: #fff; background: rgba(31, 41, 55, 0.92); }
.float-a { animation: chip-float 6s ease-in-out infinite; }
.float-b { animation: chip-float 7.5s ease-in-out -2s infinite; }
.float-c { animation: chip-float 6.8s ease-in-out -4s infinite; }
@keyframes chip-float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .float-a, .float-b, .float-c { animation: none; }
}
</style>
