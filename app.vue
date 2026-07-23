<template>
  <div id="preloader">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="120"
      height="120"
      class="animate-spin"
    >
      <g data-idx="1">
        <circle
          stroke-dasharray="141.37166941154067 49.12388980384689"
          r="30"
          stroke-width="4"
          stroke="rgb(59 130 246)"
          fill="none"
          cy="50"
          cx="50"
          data-idx="2"
          transform="matrix(0.684547261237544,-0.7289684815766575,0.7289684815766575,0.684547261237544,-20.67578714071007,52.22106101695567)"
        />
      </g>
    </svg>
  </div>

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <ClientOnly>
    <SubscriptionRenewalModal
      v-if="showSubscriptionModal"
      :model-value="showSubscriptionModal"
      :subscription-status="null"
      :is-expired="true"
      :is-past-due="false"
      :is-trialing="false"
      :trial-ends-at="null"
      :current-period-end="null"
      @renew="handleSubscriptionRenew"
      @close="handleSubscriptionClose"
    />
    <PhoneRequiredModal />
  </ClientOnly>

  <UNotifications :ui="notificationsUi" />
  <ConfirmDialog />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { setAtraceUnauthorizedHandler } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { ALL_APPS } from '@/config/apps';
import SubscriptionRenewalModal from '@/components/SubscriptionRenewalModal.vue';
import PhoneRequiredModal from '@/components/PhoneRequiredModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const route = useRoute();
const { t, locale, setLocale } = useI18n();
const config = useRuntimeConfig();
const { titleBySlug } = useNamespace();
const subscriptionError = useState<string | null>('subscription_error', () => null);
const subscriptionErrorShown = useState<boolean>('subscription_error_shown', () => false);
const supportedLocales = ['ru', 'en', 'kk'] as const;
type SupportedLocale = (typeof supportedLocales)[number];

function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

const showSubscriptionModal = computed(() => Boolean(subscriptionError.value) && !subscriptionErrorShown.value);

const baseTitle = computed(() => t('app.title') || 'lota');

function formatSegment(segment?: string) {
  if (!segment) return '';
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const pageTitle = computed(() => {
  const path = route.path || '';
  const segments = path.split('/').filter(Boolean);

  if (!segments.length) return 'Hub'; // Main page title

  if (segments[0] === 'to') {
    const ns = segments[1];
    if (segments[2] === 'atrace') {
      const appTitle = t('app.atraceTitle') || t('app.attendance') || 'A-Trace';
      return ns ? `${appTitle} — ${ns}` : appTitle;
    }
    return ns ? `${baseTitle.value} — ${ns}` : baseTitle.value;
  }

  const nsSlug = (route.params.namespace as string | undefined) || segments[0];
  const nsTitle = titleBySlug(nsSlug) || nsSlug || '';

  if (nsSlug && segments.length >= 2) {
    const appSegment = segments[1];
    const app = ALL_APPS.find((item) => item.address === appSegment);
    const appTitle = app ? (t(app.titleKey) || app.name) : formatSegment(appSegment);
    const extra = segments[2] ? formatSegment(segments[2]) : '';
    if (extra) return `${appTitle} — ${nsTitle} — ${extra}`;
    return nsTitle ? `${appTitle} — ${nsTitle}` : appTitle;
  }

  return `${baseTitle.value} — ${formatSegment(segments[0])}`;
});

useHead(() => ({
  title: pageTitle.value,
}));

const normalizedSiteUrl = computed(() => String(config.public.siteUrl || 'https://lota.tools').replace(/\/$/, ''));

const routeSegments = computed(() => route.path.split('/').filter(Boolean));
const isConsoleRoute = computed(() => route.path.startsWith('/console'));
const isPublicationEditorRoute = computed(() => /^\/console\/publications(?:\/|$)/.test(route.path));
const isSharedNamespaceRoute = computed(() => /^\/to\/[^/]+(?:\/|$)/.test(route.path));

const notificationsUi = computed(() => {
  if (!isPublicationEditorRoute.value) return {};
  return {
    position: 'top-[unset] bottom-0'
  };
});
const PUBLIC_CATEGORY_PREFIXES = new Set(['news', 'articles', 'whatsnew']);
const isNamespacePrivateRoute = computed(() => {
  const segments = routeSegments.value;
  if (segments.length < 2) return false;
  const first = segments[0];
  return first !== 'console' && first !== 'to' && !PUBLIC_CATEGORY_PREFIXES.has(first);
});
const isPeopleRoute = computed(() => route.path === '/people');
const isPrivateRoute = computed(() => {
  return isConsoleRoute.value || isSharedNamespaceRoute.value || isNamespacePrivateRoute.value || isPeopleRoute.value;
});

const isArticleRoute = computed(() => {
  const segments = routeSegments.value;
  if (segments.length !== 1) return false;
  const first = segments[0];
  return first !== 'feed' && first !== 'people' && first !== 'console' && first !== 'to';
});

const queryLang = computed(() => {
  const raw = route.query.lang;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').toLowerCase();
});

watch(
  queryLang,
  (value) => {
    if (!value || !isSupportedLocale(value) || locale.value === value) return;
    setLocale(value);
  },
  { immediate: true }
);

const canonicalUrl = computed(() => {
  if (isPrivateRoute.value || isArticleRoute.value) return '';

  const base = normalizedSiteUrl.value;
  const path = route.path === '/' ? '/' : route.path.replace(/\/$/, '');
  const url = new URL(path, `${base}/`);

  if (isSupportedLocale(queryLang.value)) {
    url.searchParams.set('lang', queryLang.value);
  }

  return url.toString();
});

const hreflangLinks = computed(() => {
  if (!canonicalUrl.value || isPrivateRoute.value || isArticleRoute.value) return [];

  const base = normalizedSiteUrl.value;
  const path = route.path === '/' ? '/' : route.path.replace(/\/$/, '');
  const defaultUrl = new URL(path, `${base}/`).toString();
  const links = [
    { rel: 'alternate', hreflang: 'x-default', href: defaultUrl },
  ];

  for (const lang of supportedLocales) {
    const localizedUrl = new URL(path, `${base}/`);
    localizedUrl.searchParams.set('lang', lang);
    links.push({ rel: 'alternate', hreflang: lang, href: localizedUrl.toString() });
  }

  return links;
});

useHead(() => {
  if (isPrivateRoute.value) {
    return {
      meta: [
        { name: 'robots', content: 'noindex, nofollow, noarchive' },
        { name: 'googlebot', content: 'noindex, nofollow' },
      ],
    };
  }

  if (!canonicalUrl.value || isArticleRoute.value) {
    return {};
  }

  return {
    link: [
      { rel: 'canonical', href: canonicalUrl.value },
      ...hreflangLinks.value,
    ],
  };
});

function handleSubscriptionRenew() {
  const nsSlug = (route.params.namespace as string | undefined) || '';
  if (nsSlug) {
    navigateTo(`/${nsSlug}/atrace/plans`);
  }
  subscriptionErrorShown.value = true;
  subscriptionError.value = null;
}

function handleSubscriptionClose() {
  subscriptionErrorShown.value = true;
  subscriptionError.value = null;
}

const onPageLoad = () => {
  setTimeout(() => {
    document.getElementById('preloader')?.remove();
  }, 100);
};

onMounted(() => {
  if (process.client) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      document.documentElement.classList.add('ios');
      document.body.classList.add('ios');
    }
  }
  if (document.readyState === 'complete') {
    onPageLoad();
  } else {
    window.addEventListener('load', onPageLoad);
  }
  
  // Register handler for atrace token expiration - just clear the token
  // The page will automatically retry with a fresh token
  setAtraceUnauthorizedHandler(() => {
    console.log('[app.vue] Atrace token expired, clearing for refresh');
    try {
      const cookie = useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' });
      cookie.value = null;
    } catch {}
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('load', onPageLoad);
});

// Give every toast a sensible default icon based on its color so it reads
// at a glance, without requiring every one of the ~40 call sites across the
// app to pass one explicitly. Patches the same shared `notifications`
// useState that Nuxt UI's useToast()/<UNotifications> already use, so it
// applies regardless of which call site added the toast.
const NOTIFICATION_ICON_BY_COLOR: Record<string, string> = {
  red: 'lucide:alert-circle',
  orange: 'lucide:alert-triangle',
  amber: 'lucide:alert-triangle',
  yellow: 'lucide:alert-triangle',
  green: 'lucide:check-circle',
  emerald: 'lucide:check-circle',
  primary: 'lucide:info',
  blue: 'lucide:info',
  gray: 'lucide:bell',
};
const notifications = useState<Array<{ id: string; color?: string; icon?: string }>>('notifications', () => []);
watch(
  notifications,
  (list) => {
    for (const n of list) {
      if (!n.icon) n.icon = NOTIFICATION_ICON_BY_COLOR[n.color || 'primary'];
    }
  },
  { deep: true }
);
</script>