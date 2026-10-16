<script setup lang="ts">
// A shared block is edited in the same editor as a page, minus the page settings.
definePageMeta({ layout: false });

import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePageTitle } from '@/composables/usePageTitle';
import { pagesApi, type PagesSite, type GlobalBlock } from '@/api/pages/ops';
import { pagesUploadMedia } from '@/api/pages/media';
import { pagesRequestWithRefresh } from '@/api/pages/pagesRequestWithRefresh';
import { siteAssetUrl, siteOrigin } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const siteId = computed(() => route.params.siteId as string);
const blockId = computed(() => route.params.blockId as string);
const { getToken } = usePagesAuth();

const loading = ref(true);
const loadError = ref('');
const site = ref<PagesSite | null>(null);
const block = ref<GlobalBlock | null>(null);
usePageTitle('pages', { subject: () => block.value?.name });

const backTo = computed(() => `/${nsSlug.value}/pages/${siteId.value}?tab=blocks`);

async function load() {
  try {
    await getToken(nsSlug.value);
    const [s, list] = await Promise.all([pagesApi.site(nsSlug.value, siteId.value), pagesApi.globalBlocks(nsSlug.value, siteId.value)]);
    const b = list.find(x => x.id === blockId.value);
    if (!s || !b) { loadError.value = t('pages.editor.notFound'); return; }
    site.value = s; block.value = b;
  } catch (e) {
    logError('[pages/blocks] load', e);
    loadError.value = getErrorMessage(e, t) || t('common.errorRetry');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const host = computed(() => site.value?.host || '');
const initialPage = computed(() => ({ title: block.value?.name || '', slug: block.value?.slug || '', status: 'draft' as const }));
const initialBlocks = computed(() => (block.value?.blocks || []).map((b) => {
  let attrs: Record<string, any> = {};
  try { const v = JSON.parse(b.attrsJson || '{}'); if (v && typeof v === 'object') attrs = v; } catch { /* plain */ }
  return { id: b.id, type: b.type, content: b.content, attrs };
}));

async function onSave(payload: { page: any; blocks: { id: string; type: string; content: string; attrs: Record<string, any> }[] }) {
  if (!block.value) return;
  const saved = await pagesApi.updateGlobalBlock(nsSlug.value, block.value.id, {
    name: payload.page.title,
    slug: block.value.slug,
    blocks: payload.blocks.map((b) => ({ id: b.id, type: b.type, content: b.content, attrsJson: Object.keys(b.attrs || {}).length ? JSON.stringify(b.attrs) : '' })),
  });
  block.value = saved;
}

async function onUploadImage(file: File): Promise<{ url: string }> {
  const media = await pagesRequestWithRefresh(async () => {
    const token = await getToken(nsSlug.value);
    return pagesUploadMedia(token, nsSlug.value, siteId.value, file);
  }, nsSlug.value);
  return { url: media.url };
}

const resolveImage = (src: string) => siteAssetUrl(host.value, src);
</script>

<template>
  <div v-if="loading" class="mx-auto min-h-screen max-w-4xl bg-slate-100 px-4 py-10 dark:bg-[#141414]">
    <AppSkeleton variant="panel" :rows="3" />
  </div>

  <div v-else-if="loadError" class="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 dark:bg-[#141414]">
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{{ loadError }}</div>
    <NuxtLink :to="backTo" class="text-sm font-medium text-primary-600 dark:text-primary-400">{{ t('pages.editor.back') }}</NuxtLink>
  </div>

  <PagesEditor
    v-else
    simple
    :initial-page="initialPage"
    :initial-blocks="initialBlocks"
    :site-host="host"
    :site-origin="siteOrigin(host)"
    :ns-slug="nsSlug"
    :site-id="siteId"
    :back-to="backTo"
    :image-resolver="resolveImage"
    :on-save="onSave"
    :on-upload-image="onUploadImage"
  />
</template>
