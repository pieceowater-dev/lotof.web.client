<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

export type HomeFeedPost = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  readTime: string;
  image: string;
  imageAlt: string;
  tags: string[];
  href: string;
};

const props = defineProps<{
  posts: HomeFeedPost[];
}>();

const emit = defineEmits<{
  open: [post: HomeFeedPost];
}>();

const brokenImages = ref<Record<string, boolean>>({});

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return '?';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function onImageError(postId: string) {
  brokenImages.value[postId] = true;
}
</script>

<template>
  <section class="space-y-4 md:space-y-5" aria-label="Posts feed">
    <article
      v-for="(post, postIndex) in props.posts"
      :key="post.id"
      class="overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
      role="button"
      tabindex="0"
      @click="emit('open', post)"
      @keydown.enter="emit('open', post)"
    >
      <img
        v-if="post.image && !brokenImages[post.id]"
        :src="post.image"
        :alt="post.imageAlt"
        class="h-52 w-full object-cover sm:h-60"
        :loading="postIndex === 0 ? 'eager' : 'lazy'"
        :fetchpriority="postIndex === 0 ? 'high' : 'low'"
        decoding="async"
        width="1200"
        height="630"
        @error="onImageError(post.id)"
      />
      <div
        v-else
        class="h-52 w-full sm:h-60 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 dark:from-gray-700 dark:to-gray-800 dark:text-gray-300"
      >
        <UIcon name="lucide:image-off" class="h-12 w-12" />
      </div>

      <div class="p-4 md:p-5">
        <div class="mb-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {{ post.category }}
          </span>
          <span>{{ post.readTime }}</span>
        </div>

        <h3 class="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {{ post.title }}
        </h3>

        <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ post.excerpt }}
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200"
          >
            #{{ tag }}
          </span>
        </div>

        <div class="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-xs font-semibold text-white">
              {{ initials(post.author) }}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
                {{ post.author }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ post.publishedAt }}
              </p>
            </div>
          </div>

          <span class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
            <UIcon name="lucide:arrow-up-right" class="h-4 w-4" />
            {{ t('app.open') || 'Open' }}
          </span>
        </div>
      </div>
    </article>
  </section>
</template>
