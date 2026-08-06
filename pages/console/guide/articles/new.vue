<template>
  <GuideArticleEditor mode="create" :initial-article="initialArticle" :on-save="onSave" />
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import type { GuideApp } from '@/api/guide/public';
import { guideCreateArticle, type GuideArticleInput } from '@/api/guide/admin';

definePageMeta({ middleware: 'console-access' });
useHead({ title: 'Новая статья Гида — Консоль' });

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { token } = useAuth();

const initialArticle = {
  app: (route.query.app as GuideApp) || 'GLOBAL',
};

async function onSave(input: GuideArticleInput) {
  await guideCreateArticle(token.value || '', input);
  toast.add({ title: 'Статья сохранена', color: 'green' });
  await router.replace('/console/guide');
}
</script>
