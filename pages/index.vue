<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { hubUpdateProfile } from '@/api/hub/updateMyPhone';
import { sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';
import { usePhoneGate } from '@/composables/usePhoneGate';
import IntroSection from '@/components/IntroSection.vue';
import Modal from '@/components/Modal.vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';
import { extractFirstImage, excerptFromMarkdown, estimateReadTimeMinutes, formatPublishedDate } from '@/utils/markdown';

// Composables
const { user, token, isLoggedIn, initialized, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, titleBySlug } = useNamespace();
const { hasPhone: phoneGateHasPhone } = usePhoneGate();

const router = useRouter();
const route = useRoute();
const toast = useToast();
const colorMode = useColorMode();
const isDarkMode = computed({
  get: () => colorMode.preference === 'dark',
  set: (val: boolean) => { colorMode.preference = val ? 'dark' : 'light'; }
});

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const phone = ref('');
const phoneLooksInvalid = computed(() => Boolean(phone.value.trim()) && !isPhoneInputValid(phone.value.trim()));
const savingProfile = ref(false);

// Forces the underlying native input's DOM value back in sync -- when a
// stripped character (e.g. a letter) doesn't change the sanitized result vs.
// the previous keystroke, the reactive `phone` ref sees no change and Vue
// skips re-patching UInput's native element, leaving the raw character in
// the DOM even though `phone` itself is clean.
function onPhoneFieldInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = sanitizePhoneInput(target.value);
  if (target.value !== sanitized) target.value = sanitized;
  phone.value = sanitized;
}
const isLoading = ref(true);
const namespaceAccordionOpen = ref(true);
const settingsAccordionOpen = ref(false);
const appInstalled: Record<string, boolean> = reactive({}); // key by bundle
let appsCheckSeq = 0; // sequence guard to avoid race conditions
const installingBundles = new Set<string>(); // prevent double-installs per app

const DASHBOARD_ACCORDIONS_LS_KEY = 'dashboard_accordions_state_v1';

function loadAccordionState() {
  if (!process.client) return;
  try {
    const raw = localStorage.getItem(DASHBOARD_ACCORDIONS_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { namespaceOpen?: boolean; settingsOpen?: boolean };
    if (typeof parsed.namespaceOpen === 'boolean') {
      namespaceAccordionOpen.value = parsed.namespaceOpen;
    }
    if (typeof parsed.settingsOpen === 'boolean') {
      settingsAccordionOpen.value = parsed.settingsOpen;
    }
  } catch {
    // Keep defaults when localStorage is unavailable or malformed.
  }
}

function persistAccordionState() {
  if (!process.client) return;
  try {
    localStorage.setItem(
      DASHBOARD_ACCORDIONS_LS_KEY,
      JSON.stringify({
        namespaceOpen: namespaceAccordionOpen.value,
        settingsOpen: settingsAccordionOpen.value,
      })
    );
  } catch {
    // Ignore localStorage write errors.
  }
}

function toggleNamespaceAccordion() {
  namespaceAccordionOpen.value = !namespaceAccordionOpen.value;
}

function toggleSettingsAccordion() {
  settingsAccordionOpen.value = !settingsAccordionOpen.value;
}

onMounted(async () => {
  loadAccordionState();

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
    login();
    return;
  }

  // 3) Normal init flow
  if (user.value) {
    username.value = user.value.username;
    email.value = user.value.email;
    phone.value = user.value.phone || '';
  }
  await refreshConsoleAccess();
  isLoading.value = false;

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

watch(user, (u) => {
  if (u) {
    username.value = u.username;
    email.value = u.email;
    phone.value = u.phone || '';
  }
});

const handleEditPeople = () => router.push('/people');

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

const handleSaveProfile = async () => {
  const token = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!token || !user.value) return;

  const trimmedPhone = phone.value.trim();
  if (trimmedPhone && !isPhoneInputValid(trimmedPhone)) {
    toast.add({
      title: t('app.error') || 'Ошибка',
      description: t('admin.phoneInvalid') || 'Введите корректный номер телефона',
      color: 'red',
    });
    return;
  }

  savingProfile.value = true;
  try {
    const updatedUser = await hubUpdateProfile(token, {
      id: user.value.id,
      username: username.value,
      phone: trimmedPhone,
    });
    isModalOpen.value = false;

    if (updatedUser?.username) username.value = updatedUser.username;
    if (updatedUser) phone.value = updatedUser.phone || '';
    await fetchUser(true);
  } catch (error) {
    logError('[profile] save failed', error);
    toast.add({
      title: t('app.error') || 'Ошибка',
      description: t('app.profileSaveFailed') || 'Не удалось сохранить профиль',
      color: 'red',
    });
  } finally {
    savingProfile.value = false;
  }
};

const { t, locale, setLocale } = useI18n();
const config = useRuntimeConfig();
const siteUrl = (config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');

useSeoMeta({
  title: () => t('app.title') || 'lota',
  description: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogTitle: () => t('app.title') || 'lota',
  ogDescription: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogType: 'website',
  ogUrl: siteUrl,
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

const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return t('app.greetingNight');
  if (hours < 12) return t('app.greetingMorning');
  if (hours < 18) return t('app.greetingDay');
  return t('app.greetingEvening');
});

const activeApps = computed(() => ALL_APPS.filter(a => appInstalled[a.bundle]));
const possibleApps = computed(() => ALL_APPS.filter(a => !appInstalled[a.bundle] && a.canAdd));
const comingSoonApps = computed(() => ALL_APPS.filter(a => !a.canAdd));

function appRoutePath(app: AppConfig): string | null {
  const ns = selectedNS.value;
  if (!ns) return null;
  return app.address === 'atrace' ? `/${ns}/atrace/attendance/all` : `/${ns}/${app.address}`;
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
  const ns = selectedNS.value;
  if (!app || !ns) return false;

  try {
    const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
    const tokenValue = useCookie<string | null>(CookieKeys.TOKEN).value;
    if (!tokenValue) return false;
    const installedMap = await hubAreAppsInNamespace(tokenValue, ns, [targetApp]);
    const dest = installedMap[targetApp] ? `/${ns}/${app.address}` : `/${ns}/${app.address}/plans`;
    await router.replace(dest);
    return true;
  } catch (error) {
    logError('[deep-link] handlePendingTargetApp failed', error);
    return false;
  }
}

async function checkInstalledForVisibleApps() {
  const seq = ++appsCheckSeq;
  const token = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!token || !selectedNS.value) return;
  const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
  const bundles = ALL_APPS.map(a => a.bundle);
  const installedMap = await hubAreAppsInNamespace(token, selectedNS.value, bundles);
  console.debug('[apps] installedMap', installedMap);
  // Only apply the latest result
  if (seq === appsCheckSeq) {
    for (const b of bundles) appInstalled[b] = !!installedMap[b];
    console.debug('[apps] appInstalled reactive', JSON.parse(JSON.stringify(appInstalled)));
  } else {
    console.debug('[apps] skipped outdated result', { seq, appsCheckSeq });
  }
}

function handleSwitchNamespace(ns: string) {
  setNamespace(ns);
  // Note: checkInstalledForVisibleApps() is called automatically by the watch below
}

// Re-check when selected namespace changes outside of dropdown (e.g., deep link)
watch(() => selectedNS.value, () => {
  checkInstalledForVisibleApps();
});

watch([namespaceAccordionOpen, settingsAccordionOpen], () => {
  persistAccordionState();
});

function handleLogout() {
  logout();
  isModalOpen.value = false;
}

const dashboardApps = computed(() => [
  ...activeApps.value,
  ...possibleApps.value,
  ...comingSoonApps.value,
]);

const canSeeConsoleCard = ref(false);

async function refreshConsoleAccess() {
  if (process.server || !isLoggedIn.value) {
    canSeeConsoleCard.value = false;
    return;
  }

  const authToken = token.value || useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!authToken) {
    canSeeConsoleCard.value = false;
    return;
  }

  let currentUserId = user.value?.id;
  if (!currentUserId) {
    await fetchUser();
    currentUserId = user.value?.id;
  }

  if (!currentUserId) {
    canSeeConsoleCard.value = false;
    return;
  }

  try {
    const { capitalGetAdminByUserId } = await import('@/api/capital/admin');
    const admin = await capitalGetAdminByUserId(authToken, currentUserId);
    const role = Number(admin?.role ?? -1);
    canSeeConsoleCard.value = !!admin && (role === 0 || role === 1);
  } catch (e) {
    // This used to fail silently, which made "the Console card disappeared"
    // indistinguishable from "you're not a capital admin" — log it so a
    // real backend/network failure is visible instead of just hiding the card.
    logError('[home] refreshConsoleAccess failed', e);
    canSeeConsoleCard.value = false;
  }
}

function openConsole() {
  router.push('/console');
}

watch(
  () => [isLoggedIn.value, user.value?.id, token.value],
  () => {
    refreshConsoleAccess();
  }
);

const languageOptions = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
  { value: 'kk', label: 'Қазақша', flag: '🇰🇿' },
] as const;

const currentLanguage = computed(() => {
  const current = String(locale.value || 'en');
  return languageOptions.find((item) => item.value === current) || languageOptions[0];
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

function setLanguage(lang: 'en' | 'ru' | 'kk') {
  setLocale(lang);
}

function handleDashboardApp(app: AppConfig) {
  if (appInstalled[app.bundle]) {
    handleAppClick(app.address);
    return;
  }
  if (app.canAdd) {
    handleGetApp(app);
  }
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
          <div class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
            <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
            <USkeleton class="h-4 w-[250px]" />
            <USkeleton class="h-4 w-[200px]" />
          </div>
        </template>

        <div v-if="!initialized" class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
          <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>

        <IntroSection v-else-if="!isLoggedIn" :on-action="login" />
      </ClientOnly>

      <div v-if="initialized && isLoggedIn" class="max-w-7xl mx-auto mt-4 md:mt-6 mb-16 px-3 md:px-4">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          <div class="lg:col-span-4 rounded-3xl p-6 md:p-7 bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="w-20 h-20 rounded-full bg-white/80 dark:bg-gray-700 flex items-center justify-center text-3xl font-semibold text-gray-900 dark:text-gray-100 shadow-sm">
                {{ (username || '?').charAt(0).toUpperCase() }}
              </div>
              <UButton
                icon="lucide:door-open"
                color="gray"
                variant="ghost"
                size="xs"
                class="mt-1"
                :aria-label="t('app.logout') || 'Logout'"
                @click="handleLogout"
              />
            </div>
            <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ greeting }}</p>
            <h2 class="mt-1 text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{{ username }}</h2>
            <p class="mt-2 text-lg text-gray-600 dark:text-gray-300 break-all">{{ email }}</p>

            <div class="mt-6 flex flex-wrap gap-2">
              <button
                class="px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:from-blue-600 hover:to-emerald-600 transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                @click="handleEditPeople"
              >
                <UIcon name="i-lucide-user-round-check" class="w-4 h-4" />
                {{ t('app.myPeople') }}
              </button>
              <UButton variant="soft" size="sm" class="relative" @click="isModalOpen = true">
                {{ t('app.configureProfile') }}
                <span v-if="!phoneGateHasPhone" class="absolute -right-1 -top-1 flex h-3 w-3">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                </span>
              </UButton>
            </div>
          </div>

          <div class="lg:col-span-8 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
              <button
                v-if="canSeeConsoleCard"
                class="group rounded-2xl p-3 text-center transition-all bg-white/85 dark:bg-gray-800 hover:shadow-md border border-blue-200 dark:border-blue-800"
                @click="openConsole"
              >
                <div class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center">
                  <UIcon name="lucide:terminal-square" class="w-8 h-8 bg-gradient-to-r from-blue-600 to-emerald-500 [background-color:transparent]" />
                </div>
                <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">Console</p>
                <p class="mt-1 text-[11px] leading-4 bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text font-semibold">
                  {{ t('app.open') || 'Open' }}
                </p>
              </button>

              <template v-for="app in dashboardApps" :key="app.bundle">
                <NuxtLink
                  v-if="appInstalled[app.bundle] && appRoutePath(app)"
                  :to="appRoutePath(app) || '/'"
                  class="group rounded-2xl p-3 text-center transition-all bg-white/85 dark:bg-gray-800 hover:shadow-md border border-blue-200 dark:border-blue-800"
                >
                  <div class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center">
                    <UIcon
                      :name="app.icon"
                      class="w-8 h-8 bg-gradient-to-r from-blue-600 to-emerald-500 [background-color:transparent]"
                    />
                  </div>
                  <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{{ t(app.titleKey) }}</p>
                  <p class="mt-1 text-[11px] leading-4 bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text font-semibold">
                    {{ t('app.open') || 'Open' }}
                  </p>
                </NuxtLink>

                <button
                  v-else
                  :disabled="!app.canAdd"
                  class="group rounded-2xl p-3 text-center transition-all disabled:opacity-45 disabled:cursor-not-allowed bg-white/75 dark:bg-gray-800 hover:shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  @click="handleDashboardApp(app)"
                >
                  <div class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <UIcon :name="app.icon" class="w-8 h-8" />
                  </div>
                  <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{{ t(app.titleKey) }}</p>
                  <p
                    class="mt-1 text-[11px] leading-4"
                    :class="app.canAdd ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'"
                  >
                    {{ app.canAdd ? (t('app.getApp') || 'Get') : (t('app.comingSoon') || 'Soon') }}
                  </p>
                </button>
              </template>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 text-left"
            :aria-expanded="namespaceAccordionOpen"
            @click="toggleNamespaceAccordion"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="w-9 h-9 flex-shrink-0 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300">
                <UIcon name="lucide:building-2" class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-blue-600/80 dark:text-blue-400/80">
                  {{ t('app.currentNamespace') || 'Namespace' }}
                </p>
                <h3 class="truncate text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">
                  {{ (selectedNS && (titleBySlug(selectedNS) || selectedNS)) || (t('app.selectNamespace') || 'Select active workspace') }}
                </h3>
              </div>
            </div>
            <UIcon
              name="lucide:chevron-down"
              class="w-5 h-5 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform"
              :class="namespaceAccordionOpen ? 'rotate-180' : ''"
            />
          </button>

          <div v-show="namespaceAccordionOpen" class="mt-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <button
                v-for="slug in allNamespaces"
                :key="slug"
                type="button"
                class="text-left rounded-2xl p-4 border transition-all duration-200"
                :class="selectedNS === slug
                  ? 'bg-white border-2 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500 shadow-sm'
                  : 'bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'"
                @click="handleSwitchNamespace(slug)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {{ titleBySlug(slug) || slug }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{{ slug }}</p>
                  </div>
                  <UIcon
                    v-if="selectedNS === slug"
                    name="lucide:check-circle-2"
                    class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-4 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 text-left"
            :aria-expanded="settingsAccordionOpen"
            @click="toggleSettingsAccordion"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300">
                <UIcon name="lucide:sliders-horizontal" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('app.preferences') || 'Preferences' }}
                </h3>
                <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  {{ t('app.preferencesSubtitle') || 'Language, theme & display' }}
                </p>
              </div>
            </div>
            <UIcon
              name="lucide:chevron-down"
              class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform"
              :class="settingsAccordionOpen ? 'rotate-180' : ''"
            />
          </button>

          <div v-show="settingsAccordionOpen" class="mt-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <button
                type="button"
                class="rounded-2xl p-5 border bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700 text-left transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-700"
                @click="isDarkMode = !isDarkMode"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('app.theme') || 'Theme' }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {{ isDarkMode ? (t('app.dark') || 'Dark') : (t('app.light') || 'Light') }}
                    </p>
                  </div>
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <UIcon :name="isDarkMode ? 'lucide:moon-star' : 'lucide:sun-medium'" class="w-8 h-8" />
                  </div>
                </div>
              </button>

              <div class="rounded-2xl p-5 border bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700">
                <div class="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('app.language') }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ currentLanguage.label }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="lang in languageOptions"
                    :key="lang.value"
                    type="button"
                    class="h-11 rounded-xl border text-sm font-medium transition-all"
                    :class="locale === lang.value
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                      : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-700'"
                    @click="setLanguage(lang.value)"
                  >
                    <span class="mr-1.5">{{ lang.flag }}</span>{{ lang.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="initialized && !isLoggedIn" class="max-w-7xl mx-auto mb-20 px-2 md:px-4 space-y-6 md:space-y-10">
        <div v-if="activeApps.length">
          <h3 class="text-lg font-medium mb-4">{{ t('app.installedHead') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
            <div v-for="app in activeApps" :key="app.bundle" class="h-full">
              <AppCard v-bind="toCard(app)" />
            </div>
          </div>
        </div>

        <div v-if="possibleApps.length">
          <h3 class="text-xl font-semibold mb-4">{{ t('app.availableHead') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
            <div v-for="app in possibleApps" :key="app.bundle" class="h-full">
              <AppCard v-bind="toCard(app)" />
            </div>
          </div>
        </div>

        <div v-if="comingSoonApps.length">
          <h3 class="text-xl font-semibold mb-4">{{ t('app.comingSoonHead') }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
            <div v-for="app in comingSoonApps" :key="app.bundle" class="h-full">
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

      <Modal
        v-model="isModalOpen"
        :disable-autofocus="true"
      >
        <template #header>
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-lg font-semibold text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100">
              {{ (username || '?').charAt(0).toUpperCase() }}
            </div>
            <span class="font-semibold">{{ t('app.profileEditing') }}</span>
          </div>
        </template>

        <div class="space-y-5">
          <UFormGroup :label="t('app.username') || 'Имя пользователя'">
            <UInput v-model="username" icon="lucide:user" size="lg" />
          </UFormGroup>

          <UFormGroup :label="t('app.email') || 'Email'">
            <UInput v-model="email" disabled type="email" icon="lucide:mail" size="lg" />
          </UFormGroup>

          <UFormGroup
            :label="t('admin.phone') || 'Телефон'"
            :error="phoneLooksInvalid ? (t('admin.phoneInvalid') || 'Введите корректный номер телефона') : undefined"
          >
            <UInput
              :model-value="phone"
              type="tel"
              autocomplete="tel"
              icon="lucide:phone"
              size="lg"
              :color="phoneLooksInvalid ? 'red' : undefined"
              :placeholder="t('admin.phonePlaceholder') || '+7 700 000 00 00'"
              @input="onPhoneFieldInput"
            />
            <p v-if="!phoneLooksInvalid" class="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Icon name="lucide:shield-check" class="h-3.5 w-3.5" />
              {{ t('admin.phonePrivacyHint') || 'Мы не передаём ваш номер третьим лицам' }}
            </p>
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" :label="t('app.cancel')" @click="isModalOpen = false" />
            <UButton color="primary" :loading="savingProfile" :disabled="phoneLooksInvalid" :label="t('app.save')" @click="handleSaveProfile" />
          </div>
        </template>
      </Modal>

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

</style>
