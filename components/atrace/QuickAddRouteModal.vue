<script lang="ts" setup>
import RouteModal from '@/components/atrace/RouteModal.vue';
import { useI18n } from '@/composables/useI18n';
import type { Post } from '@/types/atrace';

const props = defineProps<{
  modelValue: boolean;
  routeTitle: string;
  selectedPostId: string;
  selectedPostIds: string[];
  posts: Post[];
  buildPostLabel: (post: Post) => string;
  error?: string | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:routeTitle', value: string): void;
  (e: 'update:selectedPostId', value: string): void;
  (e: 'update:selectedPostIds', value: string[]): void;
  (e: 'save'): void;
}>();

const { t } = useI18n();

const postOptions = computed(() => {
  const used = new Set(props.selectedPostIds);
  return props.posts
    .filter((post) => !used.has(post.id))
    .map((post) => ({ label: props.buildPostLabel(post), value: post.id }));
});

function getPostLabel(postId: string): string {
  const post = props.posts.find((p) => p.id === postId);
  if (!post) return postId;
  return props.buildPostLabel(post);
}
</script>

<template>
  <RouteModal
    :model-value="modelValue"
    :title="t('app.route.titleCreate') || 'Create Route'"
    :show-edit-warning="false"
    :route-title="routeTitle"
    edit-warning=""
    :selected-post-id="selectedPostId"
    :name-label="t('app.route.form.title') || 'Название'"
    :selected-post-ids="selectedPostIds"
    :name-placeholder="t('app.route.form.titlePlaceholder') || 'Маршрут'"
    :posts-label="t('app.route.form.posts') || 'Посты маршрута'"
    :posts-hint="t('app.route.form.postsHint') || 'Добавьте посты в нужном порядке'"
    :select-placeholder="t('app.select.location') || 'Выберите пост'"
    :empty-text="t('app.route.form.noPostsSelected') || 'Посты не выбраны'"
    :cancel-label="t('common.cancel') || 'Cancel'"
    :save-label="t('common.save') || 'Save'"
    :post-options="postOptions"
    :get-post-label="getPostLabel"
    :error="error"
    :saving="saving"
    @update:model-value="emit('update:modelValue', $event)"
    @update:route-title="emit('update:routeTitle', $event)"
    @update:selected-post-id="emit('update:selectedPostId', $event)"
    @update:selected-post-ids="emit('update:selectedPostIds', $event)"
    @save="emit('save')"
  />
</template>
