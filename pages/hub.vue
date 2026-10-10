<script setup lang="ts">
import { appIconStyle } from '@/config/apps';
import HomePostsFeed from '@/components/ui/HomePostsFeed.vue';
import HomeNewsSection from '@/components/ui/HomeNewsSection.vue';
definePageMeta({ layout: 'full' });

import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { GUIDE_APP_IDS, guideAppFromParam, guideAppToParam } from '@/composables/useGuideContext';
import { guideListArticles, type GuideArticleListItem } from '@/api/guide/public';
import { hubUpdateProfile } from '@/api/hub/updateMyPhone';
import { sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';
import { usePhoneGate } from '@/composables/usePhoneGate';
import Modal from '@/components/ui/Modal.vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';
import { useAppInstallStatus } from '@/composables/useAppInstallStatus';
import { useConsoleAccess } from '@/composables/useConsoleAccess';
import type { HomeFeedPost } from '@/components/ui/HomePostsFeed.vue';
import FeedSidebarWidget from '@/components/ui/FeedSidebarWidget.vue';
import { extractFirstImage, excerptFromMarkdown, estimateReadTimeMinutes, formatPublishedDate } from '@/utils/markdown';

// /hub is the authenticated workspace -- the dashboard that used to live on
// / before / became the public marketing landing page. It always requires
// a hub session; see the redirect-to-login guard in onMounted below.
const { user, token, isLoggedIn, initialized, justLoggedOut, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, titleBySlug, idBySlug, ownerBySlug, setTitleForSlug } = useNamespace();
const { hasPhone: phoneGateHasPhone } = usePhoneGate();

// --- Rename current namespace (owner only; the slug never changes) ---
const isRenamingNs = ref(false);
const renameNsValue = ref('');
const renameNsSaving = ref(false);
const canRenameSelectedNs = computed(
  () => !!selectedNS.value && !!user.value?.id && ownerBySlug(selectedNS.value) === user.value.id,
);
function startRenameNs() {
  renameNsValue.value = titleBySlug(selectedNS.value) || selectedNS.value || '';
  isRenamingNs.value = true;
  nextTick(() => {
    const el = document.getElementById('ns-rename-input') as HTMLInputElement | null;
    el?.focus();
    el?.select();
  });
}
function cancelRenameNs() {
  isRenamingNs.value = false;
  renameNsValue.value = '';
}
async function saveRenameNs() {
  const slug = selectedNS.value;
  const id = idBySlug(slug);
  const title = renameNsValue.value.trim();
  if (!slug || !id || !token.value) return;
  if (!title) {
    toast.add({ title: t('app.error') || 'Ошибка', description: t('app.namespaceNameRequired') || 'Введите название', color: 'red' });
    return;
  }
  if (title === (titleBySlug(slug) || '')) { cancelRenameNs(); return; }
  renameNsSaving.value = true;
  try {
    const { hubRenameNamespace } = await import('@/api/hub/namespaces/update');
    const res = await hubRenameNamespace(token.value, id, slug, title);
    setTitleForSlug(slug, res.title);
    isRenamingNs.value = false;
    toast.add({ title: t('app.saved') || 'Сохранено', description: res.title, color: 'green' });
  } catch (e) {
    logError('[hub] rename namespace failed', e);
    toast.add({ title: t('app.error') || 'Ошибка', description: t('app.namespaceRenameFailed') || 'Не удалось переименовать', color: 'red' });
  } finally {
    renameNsSaving.value = false;
  }
}

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
const phone = ref('');
const phoneLooksInvalid = computed(() => Boolean(phone.value.trim()) && !isPhoneInputValid(phone.value.trim()));
const savingProfile = ref(false);

function onPhoneFieldInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = sanitizePhoneInput(target.value);
  if (target.value !== sanitized) target.value = sanitized;
  phone.value = sanitized;
}

// iOS-style app icons: continuous-corner squircle clip path (unit box, the
// icon is square so objectBoundingBox keeps the corners round) + a colour per
// app so the daily-use tiles are recognisable at a glance.
const ICON_CORNER = [
  [1.08849296, 0], [0.86840694, 0], [0.63149379, 0.07491139],
  [0.37282383, 0.16905956], [0.16905956, 0.37282383], [0.07491139, 0.63149379],
  [0, 0.86840694], [0, 1.08849296], [0, 1.52866483],
];
const iconSquirclePath = (() => {
  const r = 0.2237 / 1.0; // iOS icon corner radius / icon size
  const ext = 1.52866483 * r;
  const f = (n: number) => n.toFixed(4);
  const corner = (map: (a: number, b: number) => [number, number]) => {
    let out = '';
    for (let i = 0; i < ICON_CORNER.length; i += 3) {
      const pts = [0, 1, 2].map((k) => map(ICON_CORNER[i + k][0] * r, ICON_CORNER[i + k][1] * r));
      out += `C${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(',')}`;
    }
    return out;
  };
  return `M${f(ext)} 0L${f(1 - ext)} 0${corner((a, b) => [1 - a, b])}L1 ${f(1 - ext)}${corner((a, b) => [1 - b, 1 - a])}L${f(ext)} 1${corner((a, b) => [a, 1 - b])}L0 ${f(ext)}${corner((a, b) => [b, a])}Z`;
})();
// Guide block at the bottom of the hub: a product switcher with a live
// preview of that product's newest Guide articles.
const guideLinks = computed(() => [
  ...GUIDE_APP_IDS.map((id) => {
    const app = ALL_APPS.find((a) => a.address === id);
    return { id: id as string, to: `/guide/${id}`, label: app ? t(app.titleKey) : id, icon: app?.icon || 'lucide:layout-grid' };
  }),
  { id: 'global', to: `/guide/${guideAppToParam('GLOBAL')}`, label: t('guide.appGlobal'), icon: 'lucide:help-circle' },
]);
const guideTab = ref('global');
const guidePreview = reactive<Record<string, GuideArticleListItem[]>>({});
const guideTabLink = computed(() => guideLinks.value.find((g) => g.id === guideTab.value) || guideLinks.value[0]);
const guideTabArticles = computed(() => guidePreview[guideTab.value] || []);
function guideArticleTitle(a: GuideArticleListItem): string {
  const l = locale.value === 'kk' ? 'Kk' : locale.value === 'en' ? 'En' : 'Ru';
  return ((a as unknown as Record<string, string>)[`title${l}`] || a.titleRu || a.slug) as string;
}
async function loadGuidePreview() {
  const ids = [...GUIDE_APP_IDS, 'global'] as string[];
  await Promise.all(ids.map(async (id) => {
    const app = guideAppFromParam(id);
    if (!app) return;
    try {
      guidePreview[id] = (await guideListArticles(app)).slice(0, 4);
    } catch (e) {
      logError('[hub] guide preview failed', e);
      guidePreview[id] = [];
    }
  }));
  // open on the first product that actually has articles
  const first = ids.find((id) => (guidePreview[id] || []).length > 0);
  if (first) guideTab.value = first;
}
onMounted(() => { loadGuidePreview(); });
const namespaceAccordionOpen = ref(false);
const settingsAccordionOpen = ref(false);
const { appInstalled, appRoutePath: sharedAppRoutePath, ensureAppInstallStatus } = useAppInstallStatus();

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

watch([namespaceAccordionOpen, settingsAccordionOpen], () => {
  persistAccordionState();
});

async function checkInstalledForVisibleApps() {
  if (!selectedNS.value) return;
  await ensureAppInstallStatus(selectedNS.value);
}

watch(() => selectedNS.value, () => {
  checkInstalledForVisibleApps();
});

function handleSwitchNamespace(ns: string) {
  setNamespace(ns);
}

function appRoutePath(app: AppConfig): string | null {
  const ns = selectedNS.value;
  if (!ns) return null;
  return sharedAppRoutePath(app, ns);
}

// The external, customer-facing page for the apps that have one — opened in
// a new tab straight from the app's own dashboard tile (no separate tile).
const STOREFRONT_BY_ADDRESS: Record<string, string> = {
  menu: 'menu',
  contacts: 'memberships',
  plans: 'plans',
};
function storefrontPath(app: AppConfig): string | null {
  const ns = selectedNS.value || allNamespaces.value?.[0];
  const seg = STOREFRONT_BY_ADDRESS[app.address];
  if (!ns || !seg) return null;
  return `/to/${ns}/${seg}`;
}

const handleEditPeople = () => router.push('/people');

async function handleAppClick(appAddress: string) {
  if (!isLoggedIn.value) return login('/hub');
  const ns = selectedNS.value;
  if (!ns) return;
  if (appAddress === 'atrace') {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN).value;
      if (!hubToken) return login('/hub');
      const { ensure } = useAtraceToken();
      const atraceToken = await ensure(ns, hubToken);
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
      if (!hubToken) return login('/hub');
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
  await nextTick();
  const path = appAddress === 'atrace' ? `/${ns}/atrace/attendance/all` : `/${ns}/${appAddress}`;
  router.push(path);
}

async function handleGetApp(app: AppConfig) {
  if (!isLoggedIn.value) return login('/hub');
  if (!selectedNS.value) return;
  await router.push({
    path: `/${selectedNS.value}/${app.address}/plans`,
    query: { returnTo: `/${selectedNS.value}/${app.address}` }
  });
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

const handleSaveProfile = async () => {
  const tokenValue = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!tokenValue || !user.value) return;

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
    const updatedUser = await hubUpdateProfile(tokenValue, {
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

useSeoMeta({ title: () => t('app.hubTitle') || 'lota — Рабочее пространство', robots: 'noindex, nofollow' });
useHead({ titleTemplate: (s) => s ?? 'lota' });

const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return t('app.greetingNight');
  if (hours < 12) return t('app.greetingMorning');
  if (hours < 18) return t('app.greetingDay');
  return t('app.greetingEvening');
});

function handleLogout() {
  logout();
  isModalOpen.value = false;
  router.push('/');
}

const dashboardApps = computed(() => ALL_APPS);
const { canSeeConsole: canSeeConsoleCard, refreshConsoleAccess } = useConsoleAccess();

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

function setLanguage(lang: 'en' | 'ru' | 'kk') {
  setLocale(lang);
}

// --- Article feed (same content/logic as the public landing page) ---
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
const hubPublicationsAuthRefreshDone = useState<boolean>('hub-publications-auth-refresh-done', () => false);

onMounted(() => {
  const hasToken = !!String(publicationAuthToken.value || publicationLegacyToken.value || '').trim();
  if (!hasToken || hubPublicationsAuthRefreshDone.value) return;
  hubPublicationsAuthRefreshDone.value = true;
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

function applyFeedViewport(matchesMobile: boolean) {
  isMobileFeedViewport.value = matchesMobile;
  const initialLimit = matchesMobile ? MOBILE_INITIAL_FEED_LIMIT : DESKTOP_INITIAL_FEED_LIMIT;
  feedVisibleCount.value = Math.min(initialLimit, maxFeedCards.value);
}

function onMobileFeedMediaChange(event: MediaQueryListEvent) {
  applyFeedViewport(event.matches);
}

const maxFeedCards = computed(() => filteredArticleFeedPosts.value.length);
const maxVisibleFeedCards = computed(() => maxFeedCards.value);
const visibleArticleFeedPosts = computed(() => {
  const limit = Math.min(maxVisibleFeedCards.value, feedVisibleCount.value);
  return filteredArticleFeedPosts.value.slice(0, limit);
});
const localizedVisibleArticleFeedPosts = computed(() => visibleArticleFeedPosts.value);
const canAutoLoadMoreFeedPosts = computed(() => visibleArticleFeedPosts.value.length < maxVisibleFeedCards.value);

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

function handleNavigateToNews() {
  router.push('/news');
}

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

// --- Auth gate: /hub always requires a hub session ---
onMounted(async () => {
  await nextTick();
  await fetchUser();

  if (!isLoggedIn.value) {
    if (justLoggedOut.value) {
      justLoggedOut.value = false;
      router.replace('/');
      return;
    }
    login('/hub');
    return;
  }

  if (user.value) {
    username.value = user.value.username;
    email.value = user.value.email;
    phone.value = user.value.phone || '';
  }
  loadAccordionState();
  await refreshConsoleAccess();

  checkInstalledForVisibleApps().catch((error) => {
    logError('[apps] startup install check failed', error);
  });
});

watch(user, (u) => {
  if (u) {
    username.value = u.username;
    email.value = u.email;
    phone.value = u.phone || '';
  }
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

        <div v-if="!initialized || !isLoggedIn" class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
          <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
      </ClientOnly>

      <!-- HUB: compact daily launcher (iCloud-style app grid on top). -->
      <div v-if="initialized && isLoggedIn" class="relative -mt-20 overflow-hidden">
        <svg width="0" height="0" class="absolute" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="hub-ios-icon" clipPathUnits="objectBoundingBox"><path :d="iconSquirclePath" /></clipPath>
          </defs>
        </svg>
        <div class="relative mx-auto max-w-7xl px-4 pb-12 pt-24 md:pb-16 md:pt-28">

          <!-- account bar -->
          <div v-reveal class="flex flex-wrap items-center gap-3 md:gap-4">
            <div class="avatar-ring flex-shrink-0"><div class="avatar-core">{{ (username || '?').charAt(0).toUpperCase() }}</div></div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ greeting }}</p>
              <h1 class="truncate text-xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-2xl">{{ username }}</h1>
              <p class="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">{{ email }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="cta-pill cta-pill--primary hub-pill" @click="handleEditPeople">
                <UIcon name="lucide:user-round-check" class="h-4 w-4" />
                <span class="hidden sm:inline">{{ t('app.myPeople') }}</span>
              </button>
              <button type="button" class="icon-btn relative" :title="t('app.configureProfile')" :aria-label="t('app.configureProfile')" @click="isModalOpen = true">
                <UIcon name="lucide:settings-2" class="h-5 w-5" />
                <span v-if="!phoneGateHasPhone" class="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                </span>
              </button>
              <button type="button" class="icon-btn" :title="t('app.logout') || 'Logout'" :aria-label="t('app.logout') || 'Logout'" @click="handleLogout">
                <UIcon name="lucide:log-out" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- apps: the daily launcher -->
          <div v-reveal="60" class="mt-5">
            <div class="bezel">
              <div class="bezel-core px-3 py-6 sm:px-6 md:py-8">
                <div class="grid grid-cols-3 gap-x-2 gap-y-7 sm:grid-cols-4 md:flex md:flex-wrap md:justify-start md:gap-x-5 md:[&>*]:w-28">
                  <div v-if="canSeeConsoleCard">
                    <button type="button" class="app-tile group" @click="openConsole">
                      <span class="app-icon-wrap"><span class="app-icon" :style="appIconStyle('console')"><UIcon name="lucide:terminal-square" class="app-glyph" /></span></span>
                      <span class="app-label">Console</span>
                    </button>
                  </div>

                  <template v-for="app in dashboardApps" :key="app.bundle">
                    <div v-if="appInstalled[app.bundle] && appRoutePath(app)" class="relative">
                      <NuxtLink :to="appRoutePath(app) || '/'" class="app-tile group">
                        <span class="app-icon-wrap"><span class="app-icon" :style="appIconStyle(app.address)"><UIcon :name="app.icon" class="app-glyph" /></span></span>
                        <span class="app-label">{{ t(app.titleKey) }}</span>
                      </NuxtLink>
                      <!-- external customer-facing page: small badge, opens in a new tab and never steals the tile's own click -->
                      <a
                        v-if="storefrontPath(app)"
                        :href="storefrontPath(app) || '#'"
                        target="_blank"
                        rel="noopener"
                        :aria-label="t('app.externalStorefront') || 'Витрина'"
                        class="tile-corner tile-corner--icon"
                        @click.stop
                      >
                        <UIcon name="lucide:external-link" class="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div v-else>
                    <button type="button" :disabled="!app.canAdd" class="app-tile app-tile--off group disabled:cursor-not-allowed" @click="handleDashboardApp(app)">
                      <span class="app-icon-wrap">
                        <span class="app-icon" :style="appIconStyle(app.address)"><UIcon :name="app.icon" class="app-glyph" /></span>
                        <span v-if="app.canAdd" class="app-plus"><UIcon name="lucide:plus" class="h-3.5 w-3.5" /></span>
                      </span>
                      <span class="app-label">{{ t(app.titleKey) }}</span>
                      <span class="-mt-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">{{ app.canAdd ? (t('app.getApp') || 'Get') : (t('app.comingSoon') || 'Soon') }}</span>
                    </button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- workspace strip -->
          <div v-reveal="120" class="mt-5">
            <div class="bezel">
              <div class="bezel-core px-4 py-3 md:px-5">
                <form v-if="isRenamingNs" class="flex flex-wrap items-center gap-x-3 gap-y-3" @submit.prevent="saveRenameNs">
                  <div class="icon-tile icon-tile--sm"><UIcon name="lucide:building-2" class="h-5 w-5" /></div>
                  <div class="min-w-[12rem] flex-1 sm:max-w-md">
                    <input
                      id="ns-rename-input"
                      v-model="renameNsValue"
                      type="text"
                      maxlength="64"
                      :placeholder="t('app.namespaceName') || 'Название'"
                      class="ns-field"
                      @keydown.esc="cancelRenameNs"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="submit" :disabled="renameNsSaving" class="cta-pill cta-pill--primary hub-pill !h-10 disabled:opacity-60">
                      <UIcon :name="renameNsSaving ? 'lucide:loader-2' : 'lucide:check'" class="h-4 w-4" :class="renameNsSaving ? 'animate-spin' : ''" />
                      {{ t('app.save') || 'Сохранить' }}
                    </button>
                    <button type="button" class="icon-btn" :aria-label="t('app.cancel') || 'Отмена'" @click="cancelRenameNs">
                      <UIcon name="lucide:x" class="h-5 w-5" />
                    </button>
                  </div>
                  <p class="basis-full text-xs text-gray-400 dark:text-gray-500 sm:pl-[3.25rem]">
                    {{ t('app.slugCannotChange') || 'Адрес (slug) не меняется' }}: <span class="font-mono">{{ selectedNS }}</span>
                  </p>
                </form>

                <div v-else class="flex w-full items-center gap-2 md:gap-3">
                  <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" :aria-expanded="namespaceAccordionOpen" @click="toggleNamespaceAccordion">
                    <div class="icon-tile icon-tile--sm"><UIcon name="lucide:building-2" class="h-5 w-5" /></div>
                    <div class="min-w-0">
                      <p class="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 sm:block">{{ t('app.currentNamespace') || 'Namespace' }}</p>
                      <h2 class="truncate text-base font-bold tracking-tight text-gray-900 dark:text-white md:text-lg">
                        {{ (selectedNS && (titleBySlug(selectedNS) || selectedNS)) || (t('app.selectNamespace') || 'Select active workspace') }}
                      </h2>
                    </div>
                  </button>
                  <button v-if="canRenameSelectedNs" type="button" class="icon-btn icon-btn--sm" :aria-label="t('app.renameNamespace') || 'Переименовать пространство'" :title="t('app.renameNamespace') || 'Переименовать пространство'" @click.stop="startRenameNs">
                    <UIcon name="lucide:pencil" class="h-4 w-4" />
                  </button>
                  <NuxtLink v-if="selectedNS" :to="`/${selectedNS}/bundles`" class="icon-btn icon-btn--sm md:!w-auto md:gap-1.5 md:px-3.5" :title="t('app.bundles') || 'Готовые сборки'" @click.stop>
                    <UIcon name="lucide:layers" class="h-4 w-4" />
                    <span class="hidden text-xs font-semibold md:inline">{{ t('app.bundles') || 'Готовые сборки' }}</span>
                  </NuxtLink>
                  <button type="button" class="icon-btn icon-btn--sm" :aria-label="t('app.currentNamespace') || 'Namespace'" :aria-expanded="namespaceAccordionOpen" @click="toggleNamespaceAccordion">
                    <UIcon name="lucide:chevron-down" class="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" :class="namespaceAccordionOpen ? 'rotate-180' : ''" />
                  </button>
                </div>

                <div class="acc" :class="namespaceAccordionOpen ? 'is-open' : ''" :inert="!namespaceAccordionOpen">
                  <div>
                    <div class="grid grid-cols-1 gap-2.5 pt-4 sm:grid-cols-2 xl:grid-cols-3">
                      <button
                        v-for="slug in allNamespaces"
                        :key="slug"
                        type="button"
                        class="ns-option text-left"
                        :class="selectedNS === slug ? 'ns-option--active' : ''"
                        @click="handleSwitchNamespace(slug)"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0">
                            <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ titleBySlug(slug) || slug }}</p>
                            <p class="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{{ slug }}</p>
                          </div>
                          <UIcon v-if="selectedNS === slug" name="lucide:circle-check" class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- preferences -->
          <div v-reveal="180" class="mt-5">
            <div class="bezel">
              <div class="bezel-core px-4 py-3 md:px-5">
                <button type="button" class="flex w-full items-center justify-between gap-3 text-left" :aria-expanded="settingsAccordionOpen" @click="toggleSettingsAccordion">
                  <div class="flex items-center gap-3">
                    <div class="icon-tile icon-tile--sm icon-tile--muted"><UIcon name="lucide:sliders-horizontal" class="h-5 w-5" /></div>
                    <div>
                      <h3 class="text-base font-bold tracking-tight text-gray-900 dark:text-white">{{ t('app.preferences') || 'Preferences' }}</h3>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('app.preferencesSubtitle') || 'Language, theme & display' }}</p>
                    </div>
                  </div>
                  <span class="icon-btn icon-btn--sm pointer-events-none"><UIcon name="lucide:chevron-down" class="h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]" :class="settingsAccordionOpen ? 'rotate-180' : ''" /></span>
                </button>

                <div class="acc" :class="settingsAccordionOpen ? 'is-open' : ''" :inert="!settingsAccordionOpen">
                  <div>
                    <div class="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2">
                      <button type="button" class="pref-card text-left" @click="isDarkMode = !isDarkMode">
                        <div class="flex items-center justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('app.theme') || 'Theme' }}</p>
                            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ isDarkMode ? (t('app.dark') || 'Dark') : (t('app.light') || 'Light') }}</p>
                          </div>
                          <div class="icon-tile icon-tile--sm icon-tile--muted"><UIcon :name="isDarkMode ? 'lucide:moon-star' : 'lucide:sun-medium'" class="h-5 w-5" /></div>
                        </div>
                      </button>
                      <div class="pref-card">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('app.language') }}</p>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ currentLanguage.label }}</p>
                        <div class="mt-3 grid grid-cols-3 gap-2">
                          <button
                            v-for="lang in languageOptions"
                            :key="lang.value"
                            type="button"
                            class="lang-btn"
                            :class="locale === lang.value ? 'lang-btn--active' : ''"
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
            </div>
          </div>

          <!-- guide: product switcher + live article preview -->
          <div v-reveal="240" class="mt-5">
            <div class="bezel">
              <div class="bezel-core overflow-hidden">
                <div class="grid grid-cols-1 md:grid-cols-5">
                  <div
                    class="relative flex flex-col justify-between gap-8 overflow-hidden p-6 text-white md:col-span-2 md:p-8"
                    style="background-image: linear-gradient(145deg, #2563eb, #10b981)"
                  >
                    <UIcon name="lucide:life-buoy" class="guide-ghost pointer-events-none absolute -bottom-12 -right-10 h-60 w-60" />
                    <div class="relative">
                      <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style="background: rgba(255, 255, 255, 0.18)">
                        <UIcon name="lucide:book-open" class="h-3.5 w-3.5" />
                        {{ t('app.guide') || 'Гид' }}
                      </span>
                      <h3 class="mt-4 text-2xl font-extrabold tracking-tight md:text-3xl">lota {{ t('guide.title') }}</h3>
                      <p class="mt-2 max-w-xs text-sm leading-6 md:text-base" style="opacity: 0.92">{{ t('guide.homeTagline') }}</p>
                    </div>
                    <NuxtLink to="/guide" class="cta-pill relative self-start text-sm" style="background: #fff; color: #0f172a; padding: 0.4rem 0.4rem 0.4rem 1.25rem">
                      {{ t('guide.openGuide') }}
                      <span class="cta-arrow !h-8 !w-8" style="background: rgba(15, 23, 42, 0.08)"><UIcon name="lucide:arrow-up-right" class="h-4 w-4" /></span>
                    </NuxtLink>
                  </div>

                  <div class="p-5 md:col-span-3 md:p-7">
                    <div class="flex flex-wrap gap-2" role="tablist">
                      <button
                        v-for="g in guideLinks"
                        :key="g.id"
                        type="button"
                        role="tab"
                        :aria-selected="guideTab === g.id"
                        class="guide-chip"
                        :class="guideTab === g.id ? 'guide-chip--active' : ''"
                        :style="guideTab === g.id ? appIconStyle(g.id) : undefined"
                        @click="guideTab = g.id"
                      >
                        <UIcon :name="g.icon" class="h-4 w-4" />
                        {{ g.label }}
                      </button>
                    </div>

                    <div class="mt-5 h-[14.75rem]">
                      <Transition name="guide-swap" mode="out-in">
                        <ul v-if="guideTabArticles.length" :key="guideTab" class="space-y-1.5">
                          <li v-for="a in guideTabArticles" :key="a.id">
                            <NuxtLink :to="`${guideTabLink.to}/${a.slug}`" target="_blank" rel="noopener" class="guide-row group">
                              <span class="guide-row-icon"><UIcon name="lucide:file-text" class="h-4 w-4" /></span>
                              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{ guideArticleTitle(a) }}</span>
                              <UIcon name="lucide:arrow-up-right" class="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-500" />
                            </NuxtLink>
                          </li>
                        </ul>
                        <div v-else :key="guideTab + '-empty'" class="flex h-full flex-col items-start justify-center gap-3 rounded-2xl p-5 guide-empty">
                          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('guide.noArticles') }}</p>
                          <NuxtLink :to="guideTabLink.to" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-300">
                            {{ t('guide.openGuideFor') }} {{ guideTabLink.label }}
                            <UIcon name="lucide:arrow-up-right" class="h-4 w-4" />
                          </NuxtLink>
                        </div>
                      </Transition>
                    </div>

                    <NuxtLink :to="guideTabLink.to" target="_blank" rel="noopener" class="mt-3 inline-flex h-5 items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-300" :class="guideTabArticles.length ? '' : 'invisible'" :tabindex="guideTabArticles.length ? 0 : -1">
                      {{ t('guide.allArticles') }}
                      <UIcon name="lucide:arrow-right" class="h-4 w-4" />
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="initialized && isLoggedIn" ref="feedSectionRef" class="max-w-7xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300">
        <HomeNewsSection :posts="homeNewsPosts" @open="handleOpenPost" @all="handleNavigateToNews" />

        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 md:gap-8 items-start">
          <section v-if="localizedVisibleArticleFeedPosts.length > 0">
            <div class="sec-head">
              <div class="flex items-center gap-3">
                <span class="icon-tile !h-9 !w-9 !rounded-xl"><UIcon name="lucide:newspaper" class="h-[18px] w-[18px]" /></span>
                <h2 class="sec-title">{{ t('app.feed') || 'Feed' }}</h2>
              </div>
            </div>

            <NuxtErrorBoundary>
              <HomePostsFeed :posts="localizedVisibleArticleFeedPosts" @open="handleOpenPost" />
              <template #error>
                <p class="text-sm text-gray-400 dark:text-gray-500">
                  {{ t('app.feedUnavailable') || 'Не удалось загрузить ленту' }}
                </p>
              </template>
            </NuxtErrorBoundary>

            <div
              v-if="canAutoLoadMoreFeedPosts"
              ref="mobileFeedSentinel"
              class="h-px w-full"
              aria-hidden="true"
            />
          </section>

          <NuxtErrorBoundary v-if="popularArticleTags.length > 0 || whatsNewSidebarPosts.length > 0">
            <FeedSidebarWidget
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
            <template #error />
          </NuxtErrorBoundary>
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
  </div>
</template>

<style scoped>
.avatar-ring {
  display: flex;
  height: 3.25rem;
  width: 3.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 3px;
  background-image: linear-gradient(135deg, #2563eb, #10b981);
  box-shadow: 0 12px 28px -12px rgba(37, 99, 235, 0.6);
}
@media (min-width: 768px) {
  .avatar-ring { height: 3.75rem; width: 3.75rem; }
}
.avatar-core {
  display: flex;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #fff;
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}
.dark .avatar-core { background: #1a1a1a; color: #fff; }

.icon-btn {
  display: inline-flex;
  height: 2.75rem;
  width: 2.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #475569;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1);
  transition: transform 0.6s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}
.icon-btn:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.35); }
.icon-btn:active { transform: scale(0.96); }
.dark .icon-btn { color: #e2e8f0; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }

.icon-tile--muted {
  color: #2563eb;
  background-image: none;
  background-color: #eff6ff;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
}
.dark .icon-tile--muted { color: #93c5fd; background-color: rgba(255, 255, 255, 0.08); }

/* Small "open storefront" badge on an app icon's top-right corner. */
.tile-corner {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #2563eb;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08), 0 6px 14px -4px rgba(15, 23, 42, 0.3);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), color 0.3s, background 0.3s;
}
.tile-corner:hover { color: #fff; background-image: linear-gradient(135deg, #2563eb, #10b981); transform: scale(1.12); }
.tile-corner:active { transform: scale(0.94); }
.dark .tile-corner { color: #93c5fd; background: #262626; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 6px 14px -4px rgba(0, 0, 0, 0.6); }
.tile-corner--icon {
  right: calc(50% - 3.35rem);
  top: -0.45rem;
  height: 1.75rem;
  width: 1.75rem;
  opacity: 0;
  transform: scale(0.8);
}
.relative:hover > .tile-corner--icon, .tile-corner--icon:focus-visible { opacity: 1; transform: scale(1); }
.relative:hover > .tile-corner--icon:hover { transform: scale(1.12); }
/* custom label under the badge (instead of the slow native tooltip) */
.tile-corner--icon::after {
  content: attr(aria-label);
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 50%;
  transform: translate(50%, -2px);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  border-radius: 9999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #fff;
  background: #0f172a;
  transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.tile-corner--icon:hover::after, .tile-corner--icon:focus-visible::after { opacity: 1; transform: translate(50%, 0); }
@media (hover: none) { .tile-corner--icon { opacity: 1; transform: none; } .tile-corner--icon::after { display: none; } }

.ns-option {
  border-radius: 1.25rem;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.03);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.ns-option:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.3); }
.ns-option--active { background: #fff; box-shadow: inset 0 0 0 2px #2563eb, 0 12px 24px -16px rgba(37, 99, 235, 0.5); }
.dark .ns-option { background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09); }
.dark .ns-option--active { background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 2px #3b82f6; }

.pref-card {
  border-radius: 1.25rem;
  padding: 1.25rem;
  background: rgba(15, 23, 42, 0.03);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
}
.dark .pref-card { background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09); }
button.pref-card { transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1); }
button.pref-card:hover { transform: translateY(-2px); }

.lang-btn {
  height: 2.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.lang-btn:hover { box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.4); }
.lang-btn:active { transform: scale(0.97); }
.lang-btn--active { color: #1d4ed8; background: #eff6ff; box-shadow: inset 0 0 0 2px #2563eb; }
.dark .lang-btn { color: #e2e8f0; background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
.dark .lang-btn--active { color: #93c5fd; background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 2px #3b82f6; }

.hub-pill { height: 2.75rem; padding: 0 1.25rem; font-size: 0.875rem; gap: 0.5rem; }
.icon-btn--sm { height: 2.25rem; min-width: 2.25rem; }
a.icon-btn--sm { display: inline-flex; }
.icon-tile--sm { height: 2.5rem; width: 2.5rem; border-radius: 0.8rem; }

/* Accordion: animate height via grid rows (0fr -> 1fr) plus a fade. */
.acc {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.55s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.acc.is-open { grid-template-rows: 1fr; opacity: 1; }
.acc > div { min-height: 0; overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  .acc { transition: none; }
}

/* iOS / iCloud-style launcher tiles */
.app-tile {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  outline-offset: 6px;
}
.app-icon-wrap {
  position: relative;
  display: block;
  width: min(100%, 5.25rem);
  aspect-ratio: 1 / 1;
  filter: drop-shadow(0 8px 14px rgba(15, 23, 42, 0.18));
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), filter 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.app-tile:hover .app-icon-wrap { transform: translateY(-3px) scale(1.05); filter: drop-shadow(0 14px 20px rgba(15, 23, 42, 0.24)); }
.app-tile:active .app-icon-wrap { transform: scale(0.95); }
.app-icon {
  display: flex;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: center;
  color: #fff;
  clip-path: url(#hub-ios-icon);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
}
.app-glyph { width: 42%; height: 42%; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.18)); }
.app-label { max-width: 100%; font-size: 0.8125rem; font-weight: 600; line-height: 1.2; color: #1e293b; word-break: break-word; }
.dark .app-label { color: #e2e8f0; }
.app-tile--off .app-icon-wrap { opacity: 0.55; filter: grayscale(0.35) drop-shadow(0 6px 10px rgba(15, 23, 42, 0.12)); }
.app-tile--off:hover .app-icon-wrap { opacity: 0.9; filter: none; }
.app-plus {
  position: absolute;
  right: -0.15rem;
  bottom: -0.15rem;
  display: flex;
  height: 1.5rem;
  width: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #fff;
  background: #2563eb;
  box-shadow: 0 0 0 3px #fff;
}
.dark .app-plus { box-shadow: 0 0 0 3px #1a1a1a; }

.guide-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1), color 0.3s;
}
.guide-chip:hover { transform: translateY(-2px); color: #1d4ed8; box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.35); }
.guide-chip:active { transform: scale(0.97); }
.dark .guide-chip { color: #e2e8f0; background: rgba(255, 255, 255, 0.05); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .guide-chip:hover { color: #93c5fd; }

.guide-chip--active { color: #fff !important; box-shadow: 0 8px 18px -8px rgba(37, 99, 235, 0.55) !important; }
.guide-ghost { opacity: 0.16; transform: rotate(-12deg); }
.guide-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 0.65rem 0.8rem;
  background: rgba(15, 23, 42, 0.03);
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), background 0.3s;
}
.guide-row:hover { transform: translateX(3px); background: rgba(37, 99, 235, 0.08); }
.guide-row-icon { display: flex; height: 2rem; width: 2rem; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 0.65rem; color: #2563eb; background: #fff; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08); }
.dark .guide-row { background: rgba(255, 255, 255, 0.04); }
.dark .guide-row:hover { background: rgba(255, 255, 255, 0.08); }
.dark .guide-row-icon { color: #93c5fd; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.guide-empty { background: rgba(15, 23, 42, 0.03); box-shadow: inset 0 0 0 1px dashed rgba(15, 23, 42, 0.08); }
.dark .guide-empty { background: rgba(255, 255, 255, 0.04); }
.guide-swap-enter-active, .guide-swap-leave-active { transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
.guide-swap-enter-from { opacity: 0; transform: translateY(8px); }
.guide-swap-leave-to { opacity: 0; transform: translateY(-6px); }

.ns-field {
  height: 2.5rem;
  width: 100%;
  border-radius: 0.85rem;
  padding: 0 0.9rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  background: #fff;
  outline: none !important;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.14);
  transition: box-shadow 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.ns-field::placeholder { font-weight: 500; color: #94a3b8; }
.ns-field:focus { box-shadow: inset 0 0 0 1.5px #2563eb, 0 0 0 4px rgba(37, 99, 235, 0.14); }
.dark .ns-field { color: #fff; background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16); }
.dark .ns-field:focus { box-shadow: inset 0 0 0 1.5px #3b82f6, 0 0 0 4px rgba(59, 130, 246, 0.22); }
</style>
