<script setup lang="ts">
// Full-screen page editor (layout: false — the editor owns the whole viewport, like the console one).
definePageMeta({ layout: false });

import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n';
import { usePagesAuth } from '@/composables/usePagesAuth';
import { usePageTitle } from '@/composables/usePageTitle';
import { pagesApi, type PagesSite, type SitePage, type SiteCategory, type GlobalBlock } from '@/api/pages/ops';
import { pagesUploadMedia } from '@/api/pages/media';
import { pagesRequestWithRefresh } from '@/api/pages/pagesRequestWithRefresh';
import { siteAssetUrl, siteOrigin, toSiteRelative } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const siteId = computed(() => route.params.siteId as string);
const pageId = computed(() => route.params.pageId as string);
const { getToken } = usePagesAuth();

const loading = ref(true);
const loadError = ref('');
const site = ref<PagesSite | null>(null);
const page = ref<SitePage | null>(null);
const allPages = ref<SitePage[]>([]);
const categories = ref<SiteCategory[]>([]);
const globalBlocks = ref<GlobalBlock[]>([]);
const editorKey = ref(0);
usePageTitle('pages', { subject: () => page.value?.title });

const backTo = computed(() => `/${nsSlug.value}/pages/${siteId.value}`);

async function load() {
  try {
    await getToken(nsSlug.value);
    const [s, p, all, cats, gbs] = await Promise.all([pagesApi.site(nsSlug.value, siteId.value), pagesApi.page(nsSlug.value, pageId.value), pagesApi.pages(nsSlug.value, siteId.value), pagesApi.categories(nsSlug.value, siteId.value), pagesApi.globalBlocks(nsSlug.value, siteId.value).catch(() => [] as GlobalBlock[])]);
    if (!s || !p || p.siteId !== s.id) { loadError.value = t('pages.editor.notFound'); return; }
    site.value = s; page.value = p; allPages.value = all; categories.value = cats; globalBlocks.value = gbs;
  } catch (e) {
    logError('[pages/edit] load', e);
    loadError.value = getErrorMessage(e, t) || t('common.errorRetry');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const host = computed(() => site.value?.host || '');
const isHome = computed(() => page.value?.path === '/');
const parentPath = computed(() => {
  const p = page.value;
  if (!p || p.path === '/') return '';
  return p.path.slice(0, p.path.length - p.slug.length - 1);
});

// A page can't sit under itself or its own descendants.
const excluded = computed(() => {
  const banned = new Set<string>([pageId.value]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of allPages.value) if (x.parentId && banned.has(x.parentId) && !banned.has(x.id)) { banned.add(x.id); grew = true; }
  }
  return banned;
});

async function onMove(parentId: string, sort: number) {
  try {
    const moved = await pagesApi.movePage(nsSlug.value, pageId.value, parentId || null, sort);
    if (page.value) page.value = { ...page.value, parentId: moved.parentId, path: moved.path, sort: moved.sort };
    allPages.value = await pagesApi.pages(nsSlug.value, siteId.value);
    useToast().add({ title: t('pages.editor.moved'), color: 'green' });
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    useToast().add({ title: msg.includes('already exists') ? t('pages.pages.pathTaken') : t('common.error'), description: msg.includes('already exists') ? undefined : (msg || undefined), color: 'red' });
  }
}

async function onCategories(ids: string[]) {
  try {
    const saved = await pagesApi.setPageCategories(nsSlug.value, pageId.value, ids)
    if (page.value) page.value = { ...page.value, categoryIds: saved.categoryIds }
    useToast().add({ title: t('pages.editor.categoriesSaved'), color: 'green' })
  } catch (e: any) {
    useToast().add({ title: t('common.error'), description: String(e?.response?.errors?.[0]?.message || '') || undefined, color: 'red' })
  }
}

const initialPage = computed<Record<string, any>>(() => {
  const p = page.value;
  if (!p) return {};
  return {
    title: p.title, slug: p.slug, status: (p.status === 'PAGE_READY' ? 'ready' : 'draft') as 'ready' | 'draft', lang: p.lang || '',
    metaTitle: p.seo.title, metaDescription: p.seo.description, canonicalPath: p.seo.canonicalPath,
    ogImage: p.seo.ogImageUrl, noindex: p.seo.noindex,
  };
});

function parseAttrs(raw: string): Record<string, any> {
  if (!raw) return {};
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
const initialBlocks = computed(() => (page.value?.blocks || []).map((b) => ({
  id: b.id, type: b.type, content: b.content, attrs: parseAttrs(b.attrsJson),
})));

async function onSave(payload: { page: any; blocks: { id: string; type: string; content: string; attrs: Record<string, any> }[] }) {
  const p = payload.page;
  const saved = await pagesApi.updatePage(nsSlug.value, {
    id: pageId.value,
    slug: isHome.value ? '' : p.slug,
    title: p.title,
    status: p.status === 'ready' ? 'PAGE_READY' : 'PAGE_DRAFT',
    lang: p.lang || '',
    seo: {
      title: p.metaTitle, description: p.metaDescription, canonicalPath: p.canonicalPath,
      ogImageUrl: toSiteRelative(host.value, p.ogImage), noindex: p.noindex,
    },
    blocks: payload.blocks.map((b) => ({
      id: b.id, type: b.type, content: b.content,
      attrsJson: Object.keys(b.attrs || {}).length ? JSON.stringify(b.attrs) : '',
    })),
  });
  page.value = { ...saved };
}

async function onUploadImage(file: File): Promise<{ url: string }> {
  const media = await pagesRequestWithRefresh(async () => {
    const token = await getToken(nsSlug.value);
    return pagesUploadMedia(token, nsSlug.value, siteId.value, file);
  }, nsSlug.value);
  return { url: media.url };
}

async function onDelete() {
  await pagesApi.deletePage(nsSlug.value, pageId.value);
  await navigateTo(backTo.value);
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
    :key="editorKey"
    :initial-page="initialPage"
    :initial-blocks="initialBlocks"
    :site-host="host"
    :site-origin="siteOrigin(host)"
    :parent-path="parentPath"
    :is-home="isHome"
    :ns-slug="nsSlug"
    :site-id="siteId"
    :exclude="excluded"
    :parent-id="page?.parentId || ''"
    :sort="page?.sort || 0"
    :on-move="onMove"
    :categories="categories"
    :global-blocks="globalBlocks"
    :category-ids="page?.categoryIds || []"
    :on-categories="onCategories"
    :published="!!site?.publishedVersion"
    :back-to="backTo"
    :image-resolver="resolveImage"
    :on-save="onSave"
    :on-upload-image="onUploadImage"
    :on-delete="onDelete"
  />
</template>
