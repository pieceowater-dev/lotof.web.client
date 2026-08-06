<template>
  <div v-if="loading" class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
    <div class="text-sm text-slate-500">Загрузка статьи...</div>
  </div>
  <div v-else-if="loadError" class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
      {{ loadError }}
    </div>
  </div>
  <GuideArticleEditor
    v-else
    mode="edit"
    :initial-article="initialArticle"
    :on-save="onSave"
    :on-delete="onDelete"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { consoleGetGuideArticle, guideDeleteArticle, guideUpdateArticle, type GuideArticleInput } from '@/api/guide/admin';

definePageMeta({ middleware: 'console-access' });
useHead({ title: 'Редактирование статьи Гида — Консоль' });

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { token } = useAuth();

const articleId = String(route.params.id || '').trim();
const loading = ref(true);
const loadError = ref('');
const initialArticle = ref<Partial<GuideArticleInput>>({});

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const article = await consoleGetGuideArticle(token.value || '', articleId);
    if (!article) {
      loadError.value = 'Статья не найдена';
      return;
    }
    initialArticle.value = { ...article };
  } catch (error: any) {
    loadError.value = error?.message || 'Не удалось загрузить статью';
  } finally {
    loading.value = false;
  }
}

async function onSave(input: GuideArticleInput) {
  await guideUpdateArticle(token.value || '', articleId, input);
  toast.add({ title: 'Изменения сохранены', color: 'green' });
  await router.replace('/console/guide');
}

async function onDelete() {
  await guideDeleteArticle(token.value || '', articleId);
  toast.add({ title: 'Статья удалена', color: 'green' });
  await router.replace('/console/guide');
}

onMounted(load);
</script>
