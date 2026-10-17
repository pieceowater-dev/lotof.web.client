<script setup lang="ts">
// Draft preview of one page, opened from the editor in its own tab. It shows the page the way the site renders it
// (core builds the HTML), without scripts, and re-renders the saved draft whenever the tab is brought back.
definePageMeta({ layout: false });

import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { pagesApi } from '@/api/pages/ops';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const siteId = computed(() => route.params.siteId as string);
const pageId = computed(() => route.params.pageId as string);
const { getToken } = usePagesAuth();

const html = ref('');
const loading = ref(true);
const error = ref('');
let busy = false;

async function load() {
  if (busy) return;
  busy = true;
  loading.value = true;
  try {
    await getToken(nsSlug.value);
    html.value = await pagesApi.previewPage(nsSlug.value, siteId.value, pageId.value);
    error.value = '';
  } catch (e) {
    logError('[pages/preview] load', e);
    error.value = getErrorMessage(e, t) || t('pages.editor.previewFailed');
  } finally {
    loading.value = false;
    busy = false;
  }
}

function onVisible() { if (document.visibilityState === 'visible') load(); }
onMounted(() => {
  load();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', load);
});
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', load);
});
useHead({ title: () => t('pages.editor.preview') });
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-100 dark:bg-[#141414]">
    <div class="flex flex-shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Icon name="lucide:eye" class="h-4 w-4 flex-shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="truncate font-semibold">{{ t('pages.editor.previewBanner') }}</div>
        <div class="hidden truncate text-xs opacity-80 sm:block">{{ t('pages.editor.previewHelp') }}</div>
      </div>
      <button type="button" class="at-btn" :disabled="loading" @click="load">
        <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" :class="loading && 'animate-spin'" />{{ t('pages.editor.previewRefresh') }}
      </button>
    </div>
    <div v-if="error" class="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{{ error }}</div>
    <!-- No scripts: only popups, so the links (target=_blank) can open. -->
    <iframe v-show="html" :srcdoc="html" sandbox="allow-popups allow-popups-to-escape-sandbox" class="min-h-0 w-full flex-1 border-0 bg-white" :title="t('pages.editor.preview')" />
  </div>
</template>
