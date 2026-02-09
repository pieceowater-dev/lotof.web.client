<template>
  <div id="preloader">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120" class="animate-spin">
      <g data-idx="1">
        <circle stroke-dasharray="141.37166941154067 49.12388980384689" r="30" stroke-width="4" stroke="rgb(59 130 246)" fill="none" cy="50" cx="50" data-idx="2" transform="matrix(0.684547261237544,-0.7289684815766575,0.7289684815766575,0.684547261237544,-20.67578714071007,52.22106101695567)"></circle>
      </g>
    </svg>
  </div>

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <UNotifications />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute } from 'vue-router';
import { setAtraceUnauthorizedHandler } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { ALL_APPS } from '@/config/apps';

const route = useRoute();
const { t } = useI18n();
const { titleBySlug } = useNamespace();

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

  if (segments[0] === 'shared') {
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
</script>