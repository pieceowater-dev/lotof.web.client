<template>
  <div v-if="loading" class="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
    <div class="text-sm text-slate-500">Загрузка статьи...</div>
  </div>

  <div v-else-if="loadError" class="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-4">
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
      {{ loadError }}
    </div>
  </div>

  <ConsoleEditor
    v-else
    mode="edit"
    :initial-article="initialArticle"
    :initial-blocks="initialBlocks"
    :storage-key="`publication_editor_draft_${route.params.slug}`"
    :use-local-draft="false"
    :on-save="onSaveDraft"
    :on-publish="onPublish"
    :on-delete="onDelete"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { capitalArchivePublication, capitalGetPublicationBySlug, capitalUpdatePublication } from '@/api/publications';

definePageMeta({
  layout: false,
  middleware: 'admin',
});

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authToken = useCookie<string | null>('auth_token');
const legacyToken = useCookie<string | null>('token');

type EditorBlock = {
  id: string;
  type: string;
  content: string;
  attrs: Record<string, any>;
};

const loading = ref(true);
const loadError = ref('');
const initialArticle = ref<Record<string, any>>({});
const initialBlocks = ref<EditorBlock[]>([]);

async function loadPublication() {
  loading.value = true;
  loadError.value = '';
  try {
    const slug = String(route.params.slug || '').trim();
    const res = await capitalGetPublicationBySlug(String(authToken.value || legacyToken.value || '').trim(), slug);

    if (!res) {
      loadError.value = 'Не удалось загрузить статью';
      return;
    }

    initialArticle.value = {
      ...res.article,
    };
    initialBlocks.value = Array.isArray(res.blocks) ? res.blocks : [];
  } catch (error: any) {
    loadError.value = error?.data?.statusMessage || error?.message || 'Не удалось загрузить статью';
  } finally {
    loading.value = false;
  }
}

type EditorPayload = {
  article: Record<string, any>;
  blocks: Array<Record<string, any>>;
};

async function updatePublication(payload: EditorPayload, status: 'draft' | 'published' | 'archived') {
  const currentSlug = String(route.params.slug || '').trim();
  const nextSlug = await capitalUpdatePublication(String(authToken.value || legacyToken.value || '').trim(), currentSlug, {
    ...payload.article,
    status,
    version: String(initialArticle.value.version || ''),
    currentRevision: String(initialArticle.value.currentRevision || ''),
  } as any, payload.blocks as any);

  if (nextSlug && nextSlug !== currentSlug) {
    await router.replace(`/console/publications/${nextSlug}`);
  }

  initialArticle.value = {
    ...payload.article,
    status,
    slug: nextSlug || payload.article.slug,
  };

  toast.add({
    title: status === 'published'
      ? 'Изменения опубликованы'
      : status === 'archived'
        ? 'Публикация архивирована'
        : 'Черновик обновлен',
    color: 'green',
  });
}

async function onSaveDraft(payload: EditorPayload) {
  await updatePublication(payload, 'draft');
}

async function onPublish(payload: EditorPayload) {
  await updatePublication(payload, 'published');
  await router.replace('/console/publications');
}

async function onDelete() {
  const currentSlug = String(route.params.slug || '').trim();
  await capitalArchivePublication(String(authToken.value || legacyToken.value || '').trim(), currentSlug, String(initialArticle.value.version || ''));

  toast.add({
    title: 'Публикация архивирована',
    color: 'green',
  });

  await router.replace('/console/publications');
}

onMounted(loadPublication);
</script>
