<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import Modal from '@/components/Modal.vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import type { HomeFeedPost } from '@/components/HomePostsFeed.vue';

// Composables
const { user, isLoggedIn, initialized, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, titleBySlug } = useNamespace();

const router = useRouter();
const toast = useToast();
const colorMode = useColorMode();
const isDarkMode = computed({
  get: () => colorMode.preference === 'dark',
  set: (val: boolean) => { colorMode.preference = val ? 'dark' : 'light'; }
});

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
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
  
  // 2) Immediate auto-login if redirected with auth-needed flag
  const q0 = useRoute().query;
  if (!isLoggedIn.value && (q0['auth-needed'] === 'true' || q0['authNeeded'] === 'true')) {
    // Trigger login right away to avoid waiting on other async inits
    login();
    return;
  }

  // 3) Normal init flow
  await fetchUser();
  if (user.value) {
    username.value = user.value.username;
    email.value = user.value.email;
  }
  isLoading.value = false;

  // Run app installation check in background so first paint is not blocked.
  if (user.value) {
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
  const r = useRouter();
  const rInfo = useRoute();
  const needsScrub = rInfo.query['auth-needed'] === 'true' || rInfo.query['authNeeded'] === 'true';
  if (isLoggedIn.value && needsScrub) {
    const cleaned = { ...rInfo.query } as any;
    delete cleaned['auth-needed'];
    delete cleaned['authNeeded'];
    r.replace({ path: rInfo.path, query: cleaned });
  }
});

watch(user, (u) => {
  if (u) {
    username.value = u.username;
    email.value = u.email;
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
  if (!token) return;

  try {
    const updatedUser = await hubUpdateMe(token, username.value);
    isModalOpen.value = false;

    if (updatedUser?.username) {
      username.value = updatedUser.username;
    }
  } catch (error) {
    logError('[profile] save failed', error);
    toast.add({
      title: t('app.error') || 'Ошибка',
      description: t('app.profileSaveFailed') || 'Не удалось сохранить профиль',
      color: 'red',
    });
  }
};

const { t, locale } = useI18n();
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
  title: 'lota',
  titleTemplate: null,
  link: [{ rel: 'canonical', href: siteUrl }]
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

function toCard(app: AppConfig) {
  return {
    key: app.bundle,
    icon: app.icon,
    title: t(app.titleKey),
    name: app.name,
    description: t(app.descriptionKey),
    action: appInstalled[app.bundle]
      ? () => handleAppClick(app.address)
      : (app.canAdd ? () => handleGetApp(app) : undefined),
    installed: appInstalled[app.bundle] ?? false,
    canAdd: app.canAdd,
  };
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

const consoleWhitelist = new Set(['pieceowater@gmail.com', 'farvardmtb@gmail.com']); // TODO: move to backend and fetch dynamically
const canSeeConsoleCard = computed(() => {
  const current = String(user.value?.email || email.value || '').trim().toLowerCase();
  return consoleWhitelist.has(current);
});

function openConsole() {
  router.push('/console');
}

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

const mdFiles = import.meta.glob('../public/content/publications/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function parseFrontMatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const metaLines = match[1].split('\n');
  const body = match[2] || '';
  const meta: Record<string, string | string[]> = {};

  let currentArrayKey = '';
  for (const line of metaLines) {
    if (!line.trim()) continue;

    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      currentArrayKey = '';
      const key = keyMatch[1];
      const value = keyMatch[2]?.trim() || '';

      if (!value) {
        currentArrayKey = key;
        meta[key] = [];
        continue;
      }

      meta[key] = value.replace(/^"|"$/g, '');
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s*(.*)$/);
    if (arrayMatch && currentArrayKey) {
      const arr = Array.isArray(meta[currentArrayKey]) ? meta[currentArrayKey] as string[] : [];
      arr.push((arrayMatch[1] || '').replace(/^"|"$/g, ''));
      meta[currentArrayKey] = arr;
    }
  }

  return { meta, body };
}

function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(markdown: string): { src: string; alt: string } | null {
  const match = markdown.match(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/);
  if (!match) return null;
  return { src: match[2], alt: match[1] || '' };
}

function excerptFromBody(markdown: string): string {
  const lines = markdown.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('![') || line.startsWith('---')) continue;
    const txt = markdownToText(line);
    if (txt) return txt;
  }
  return markdownToText(markdown).slice(0, 180);
}

function readTimeLabel(markdown: string): string {
  const words = markdownToText(markdown).split(' ').filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 220));
  return `${mins} min read`;
}

function formatDate(dateISO: string): string {
  const dt = new Date(dateISO);
  if (Number.isNaN(dt.getTime())) return dateISO;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function processMarkdownPosts(): ProcessedMarkdownPost[] {
  const posts: ProcessedMarkdownPost[] = [];

  for (const [, raw] of Object.entries(mdFiles)) {
    const { meta, body } = parseFrontMatter(raw);
    const categorySlug = String(meta.category || '').toLowerCase();
    const slug = String(meta.slug || '').trim();
    const title = String(meta.title || '').trim();
    const dateISO = String(meta.date || '').trim();

    if (!slug || !title || !dateISO) continue;

    const imgFromBody = firstImage(body);
    const image = String(meta.og_image || imgFromBody?.src || '/og-image.png');
    const imageAlt = imgFromBody?.alt || title;
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const author = String(meta.author || 'Lota Team');

    posts.push({
      id: slug,
      href: `/${slug}`,
      category: categorySlug === 'whatsnew' ? "What's New" : 'Articles',
      categorySlug,
      title,
      excerpt: excerptFromBody(body),
      author,
      publishedAt: formatDate(dateISO),
      dateISO,
      readTime: readTimeLabel(body),
      image,
      imageAlt,
      tags,
    });
  }

  return posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
}

const allProcessedPosts = processMarkdownPosts();
const articleFeedPosts = computed(() => allProcessedPosts.filter((post) => post.categorySlug === 'articles'));
const articlesSearch = ref('');
const selectedArticleTag = ref('');
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
const DESKTOP_FEED_LIMIT = 30;
const MOBILE_INITIAL_FEED_LIMIT = 5;
const MOBILE_FEED_STEP = 5;
const isMobileFeedViewport = ref(false);
const mobileFeedVisibleCount = ref(MOBILE_INITIAL_FEED_LIMIT);
let mobileFeedMediaQuery: MediaQueryList | null = null;
const mobileFeedSentinel = ref<HTMLElement | null>(null);
let mobileFeedObserver: IntersectionObserver | null = null;
let mobileFeedAdvanceLocked = false;
const feedSectionRef = ref<HTMLElement | null>(null);
const isFeedSectionInView = ref(false);
const mobileSidebarMenuOpen = ref(false);
let feedSectionObserver: IntersectionObserver | null = null;

function applyFeedViewport(matchesMobile: boolean) {
  isMobileFeedViewport.value = matchesMobile;
  if (matchesMobile) {
    mobileFeedVisibleCount.value = Math.min(MOBILE_INITIAL_FEED_LIMIT, maxFeedCards.value);
  }
}

function onMobileFeedMediaChange(event: MediaQueryListEvent) {
  applyFeedViewport(event.matches);
}

const maxFeedCards = computed(() => Math.min(DESKTOP_FEED_LIMIT, filteredArticleFeedPosts.value.length));
const maxVisibleFeedCards = computed(() => {
  if (isMobileFeedViewport.value) return maxFeedCards.value;
  return maxFeedCards.value;
});
const visibleArticleFeedPosts = computed(() => {
  if (!isMobileFeedViewport.value) {
    return filteredArticleFeedPosts.value.slice(0, maxVisibleFeedCards.value);
  }

  const limit = Math.min(maxVisibleFeedCards.value, mobileFeedVisibleCount.value);
  return filteredArticleFeedPosts.value.slice(0, limit);
});
const localizedVisibleArticleFeedPosts = computed(() => {
  const articleLabel = t('app.articles') || 'Articles';
  return visibleArticleFeedPosts.value.map((post) => ({
    ...post,
    category: articleLabel,
  }));
});
const canAutoLoadMoreMobilePosts = computed(() => {
  if (!isMobileFeedViewport.value) return false;
  return visibleArticleFeedPosts.value.length < maxVisibleFeedCards.value;
});

function loadMoreMobileFeedPosts() {
  mobileFeedVisibleCount.value = Math.min(maxVisibleFeedCards.value, mobileFeedVisibleCount.value + MOBILE_FEED_STEP);
}

function maybeLoadMoreMobileFeedByScroll() {
  if (!process.client || !isMobileFeedViewport.value || mobileFeedAdvanceLocked || !canAutoLoadMoreMobilePosts.value) {
    return;
  }

  const scrollBottom = window.scrollY + window.innerHeight;
  const pageBottom = document.documentElement.scrollHeight;
  if (scrollBottom < pageBottom - 220) return;

  mobileFeedAdvanceLocked = true;
  loadMoreMobileFeedPosts();
  nextTick(() => {
    mobileFeedAdvanceLocked = false;
  });
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
  if (!process.client || !isMobileFeedViewport.value) {
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
  if (!process.client || !isMobileFeedViewport.value || !canAutoLoadMoreMobilePosts.value) {
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
        if (!first?.isIntersecting || mobileFeedAdvanceLocked || !canAutoLoadMoreMobilePosts.value) return;

        mobileFeedAdvanceLocked = true;
        loadMoreMobileFeedPosts();
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

const allWhatsNewPosts = computed(() => allProcessedPosts.filter((post) => post.categorySlug === 'whatsnew'));
const whatsNewSidebarPosts = computed(() => allWhatsNewPosts.value.slice(0, 3));
const brokenWhatsNewSidebarImages = ref<Record<string, boolean>>({});

function onWhatsNewSidebarImageError(postId: string) {
  brokenWhatsNewSidebarImages.value[postId] = true;
}

function handleOpenPost(post: HomeFeedPost) {
  if (!post.href) return;
  if (process.client) {
    window.location.assign(post.href);
    return;
  }
  router.push(post.href);
}

function setLanguage(lang: 'en' | 'ru' | 'kk') {
  locale.value = lang;
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
  mobileFeedMediaQuery = window.matchMedia('(max-width: 767px)');
  applyFeedViewport(mobileFeedMediaQuery.matches);
  mobileFeedMediaQuery.addEventListener('change', onMobileFeedMediaChange);
  window.addEventListener('scroll', maybeLoadMoreMobileFeedByScroll, { passive: true });
  ensureMobileFeedObserver();
  ensureFeedSectionObserver();
});

onBeforeUnmount(() => {
  if (!mobileFeedMediaQuery) return;
  mobileFeedMediaQuery.removeEventListener('change', onMobileFeedMediaChange);
  mobileFeedMediaQuery = null;
  window.removeEventListener('scroll', maybeLoadMoreMobileFeedByScroll);
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

watch([isMobileFeedViewport, isFeedSectionInView], ([isMobile, inView]) => {
  if (!isMobile || !inView) {
    mobileSidebarMenuOpen.value = false;
  }
});

watch([articlesSearch, selectedArticleTag], () => {
  if (!isMobileFeedViewport.value) return;
  mobileFeedVisibleCount.value = MOBILE_INITIAL_FEED_LIMIT;
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
              <UButton variant="soft" size="sm" @click="isModalOpen = true">
                {{ t('app.configureProfile') }}
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

              <button
                v-for="app in dashboardApps"
                :key="app.bundle"
                :disabled="!appInstalled[app.bundle] && !app.canAdd"
                class="group rounded-2xl p-3 text-center transition-all disabled:opacity-45 disabled:cursor-not-allowed"
                :class="appInstalled[app.bundle]
                  ? 'bg-white/85 dark:bg-gray-800 hover:shadow-md border border-blue-200 dark:border-blue-800'
                  : 'bg-white/75 dark:bg-gray-800 hover:shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800'"
                @click="handleDashboardApp(app)"
              >
                <div
                  class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
                  :class="appInstalled[app.bundle]
                    ? ''
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'"
                >
                  <UIcon
                    :name="app.icon"
                    class="w-8 h-8"
                    :class="appInstalled[app.bundle]
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-500 [background-color:transparent]'
                      : ''"
                  />
                </div>
                <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{{ t(app.titleKey) }}</p>
                <p
                  class="mt-1 text-[11px] leading-4"
                  :class="appInstalled[app.bundle]
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text font-semibold'
                    : (app.canAdd ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500')"
                >
                  {{ appInstalled[app.bundle] ? (t('app.open') || 'Open') : (app.canAdd ? (t('app.getApp') || 'Get') : (t('app.comingSoon') || 'Soon')) }}
                </p>
              </button>
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
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300">
                <UIcon name="lucide:building-2" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('app.currentNamespace') || 'Namespace' }}
                </h3>
                <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                  {{ t('app.selectNamespace') || 'Select active workspace' }}
                </p>
              </div>
            </div>
            <UIcon
              name="lucide:chevron-down"
              class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform"
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

                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="lang in languageOptions"
                    :key="lang.value"
                    type="button"
                    class="h-11 rounded-xl border text-sm font-medium transition-all"
                    :class="String(locale) === lang.value
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
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
          <section>
            <div class="mb-5 flex items-center gap-2">
              <UIcon name="lucide:newspaper" class="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">{{ t('app.feed') || 'Feed' }}</h2>
            </div>

            <div v-if="localizedVisibleArticleFeedPosts.length === 0" class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <p class="text-gray-600 dark:text-gray-400">{{ t('app.noArticlesYet') || 'Пока пусто' }}</p>
            </div>
            <HomePostsFeed v-else :posts="localizedVisibleArticleFeedPosts" @open="handleOpenPost" />

            <div
              v-if="isMobileFeedViewport && canAutoLoadMoreMobilePosts"
              ref="mobileFeedSentinel"
              class="h-px w-full"
              aria-hidden="true"
            />
          </section>

          <aside class="hidden lg:block lg:sticky lg:top-0 lg:pt-12 self-start flex flex-col h-[calc(100vh-3rem)]">
            <div class="mb-6 rounded-3xl border border-blue-100/80 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
              <div class="relative">
                <UIcon
                  name="lucide:search"
                  class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  v-model="articlesSearch"
                  type="text"
                  :placeholder="t('app.searchArticles') || 'Search articles'"
                  class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div v-if="popularArticleTags.length" class="mt-3">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('app.popularTags') || 'Popular tags' }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedArticleTag === ''
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedArticleTag = ''"
                  >
                    {{ t('app.all') || 'All' }}
                  </button>
                  <button
                    v-for="tag in popularArticleTags"
                    :key="tag"
                    type="button"
                    class="rounded-lg border px-2 py-1 text-xs transition"
                    :class="selectedArticleTag === tag
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200'"
                    @click="selectedArticleTag = tag"
                  >
                    #{{ tag }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-col flex-1 rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-800/70 overflow-hidden">
              <div class="mb-4 flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ t('app.whatsNew') || "What's New" }}</h3>
              </div>

              <div v-if="whatsNewSidebarPosts.length" class="flex-1 overflow-y-auto space-y-2.5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                <button
                  v-for="post in whatsNewSidebarPosts"
                  :key="post.id"
                  type="button"
                  class="group w-full text-left rounded-xl border border-gray-150 bg-white p-3 transition-all duration-200 hover:border-emerald-300 hover:shadow-md hover:bg-white dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-emerald-600 dark:hover:bg-gray-700/60"
                  @click="handleOpenPost(post)"
                >
                  <div class="flex items-start gap-3">
                    <div class="relative flex-shrink-0">
                      <img
                        v-if="post.image && !brokenWhatsNewSidebarImages[post.id]"
                        :src="post.image"
                        :alt="post.imageAlt"
                        class="h-14 w-14 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                        loading="lazy"
                        @error="onWhatsNewSidebarImageError(post.id)"
                      />
                      <div
                        v-else
                        class="h-14 w-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 dark:from-gray-600 dark:to-gray-700 dark:text-gray-400 flex items-center justify-center ring-1 ring-gray-200 dark:ring-gray-600"
                      >
                        <UIcon name="lucide:image-off" class="h-5 w-5" />
                      </div>
                    </div>

                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{{ post.publishedAt }}</p>
                      <p class="mt-1 text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{{ post.title }}</p>
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ post.readTime }}</p>
                    </div>
                  </div>
                </button>
              </div>

              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('app.noUpdatesForCurrentFilters') || 'No updates for current filters.' }}
              </p>
            </div>
          </aside>
        </div>

        <div
          v-if="isMobileFeedViewport && isFeedSectionInView"
          class="lg:hidden fixed inset-x-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
          style="bottom: 0;"
        >
          <div class="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
            <!-- Trigger button -->
            <button
              type="button"
              class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              :aria-expanded="mobileSidebarMenuOpen"
              @click="mobileSidebarMenuOpen = !mobileSidebarMenuOpen"
            >
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <UIcon name="lucide:sparkles" class="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </div>
                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('app.feedMenu') || 'Feed menu' }}
                </span>
              </div>
              <UIcon
                name="lucide:chevron-up"
                class="h-4 w-4 text-gray-400 transition-transform dark:text-gray-500"
                :class="mobileSidebarMenuOpen ? 'rotate-180' : ''"
              />
            </button>

            <!-- Content -->
            <Transition name="mobile-sheet">
              <div v-if="mobileSidebarMenuOpen" class="space-y-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                <!-- Search -->
                <div class="rounded-2xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-700/40">
                  <div class="relative">
                    <UIcon
                      name="lucide:search"
                      class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      v-model="articlesSearch"
                      type="text"
                      :placeholder="t('app.searchArticles') || 'Search articles'"
                      class="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-emerald-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>

                <!-- Tags -->
                <div v-if="popularArticleTags.length">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {{ t('app.popularTags') || 'Popular tags' }}
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      class="rounded-lg border px-2 py-1 text-xs transition"
                      :class="selectedArticleTag === ''
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-200'"
                      @click="selectedArticleTag = ''"
                    >
                      {{ t('app.all') || 'All' }}
                    </button>
                    <button
                      v-for="tag in popularArticleTags"
                      :key="tag"
                      type="button"
                      class="rounded-lg border px-2 py-1 text-xs transition"
                      :class="selectedArticleTag === tag
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-200 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-200'"
                      @click="selectedArticleTag = tag"
                    >
                      #{{ tag }}
                    </button>
                  </div>
                </div>

                <!-- What's New -->
                <div class="flex flex-col min-h-0">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {{ t('app.whatsNew') || "What's New" }}
                  </p>
                  <div v-if="whatsNewSidebarPosts.length" class="flex-1 overflow-y-auto space-y-1.5 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                    <button
                      v-for="post in whatsNewSidebarPosts"
                      :key="`mobile-${post.id}`"
                      type="button"
                      class="group w-full text-left rounded-lg border border-gray-200 bg-white p-2.5 transition-all hover:border-emerald-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-700/40 dark:hover:border-emerald-600"
                      @click="handleOpenPost(post)"
                    >
                      <div class="flex items-start gap-2.5">
                        <img
                          v-if="post.image && !brokenWhatsNewSidebarImages[post.id]"
                          :src="post.image"
                          :alt="post.imageAlt"
                          class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                          loading="lazy"
                          @error="onWhatsNewSidebarImageError(post.id)"
                        />
                        <div
                          v-else
                          class="h-12 w-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 dark:from-gray-600 dark:to-gray-700 dark:text-gray-400 flex items-center justify-center"
                        >
                          <UIcon name="lucide:image-off" class="h-4 w-4" />
                        </div>

                        <div class="min-w-0 flex-1">
                          <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                            {{ post.publishedAt }}
                          </p>
                          <p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {{ post.title }}
                          </p>
                          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ post.readTime }}</p>
                        </div>
                      </div>
                    </button>
                    </div>
                  <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t('app.noUpdatesForCurrentFilters') || 'No updates for current filters.' }}
                  </p>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <Modal
        v-model="isModalOpen"
        :header="t('app.profileEditing')"
        :disable-autofocus="true"
        :footer-buttons="[
          { label: t('app.cancel'), color: 'primary', variant: 'soft', onClick: () => (isModalOpen = false) },
          { label: t('app.save'), color: 'primary', variant: 'solid', onClick: handleSaveProfile }
        ]"
      >
        <div class="space-y-6">
          <UFormGroup label="Имя пользователя">
            <UInput v-model="username" />
          </UFormGroup>

          <UFormGroup label="Email">
            <UInput v-model="email" disabled type="email" />
          </UFormGroup>
        </div>
      </Modal>
    </div>

    <div class="m-4 mt-auto">
      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}

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
