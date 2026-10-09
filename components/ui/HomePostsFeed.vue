<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

export type HomeFeedPost = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  preview?: string;
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
  <section class="space-y-5 md:space-y-6" aria-label="Posts feed">
    <article
      v-for="(post, postIndex) in props.posts"
      :key="post.id"
      class="bezel bezel-hover group cursor-pointer"
      role="button"
      tabindex="0"
      @click="emit('open', post)"
      @keydown.enter="emit('open', post)"
    >
      <div class="bezel-core overflow-hidden">
        <div class="relative overflow-hidden">
          <img
            v-if="post.image && !brokenImages[post.id]"
            :src="post.image"
            :alt="post.imageAlt"
            class="h-52 w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03] sm:h-64"
            :loading="postIndex === 0 ? 'eager' : 'lazy'"
            :fetchpriority="postIndex === 0 ? 'high' : 'low'"
            decoding="async"
            width="1200"
            height="630"
            @error="onImageError(post.id)"
          />
          <div
            v-else
            class="flex h-40 w-full items-center justify-center bg-gray-100 text-gray-300 dark:bg-white/10 dark:text-gray-600 sm:h-48"
          >
            <UIcon name="lucide:newspaper" class="h-12 w-12" />
          </div>
          <span class="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 shadow-sm dark:bg-black/60 dark:text-gray-100">
            {{ post.category }}
          </span>
        </div>

        <div class="p-5 md:p-6">
          <div class="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-gray-500">
            <span>{{ post.publishedAt }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ post.readTime }}</span>
          </div>

          <h3 class="text-xl font-extrabold leading-snug tracking-tight text-gray-900 dark:text-white md:text-2xl">
            {{ post.title }}
          </h3>

          <p class="mt-2.5 text-sm leading-6 text-gray-700 dark:text-gray-200 md:text-base">
            {{ post.excerpt }}
          </p>
          <p v-if="post.preview" class="mt-1.5 line-clamp-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {{ post.preview }}
          </p>

          <div v-if="post.tags.length" class="mt-4 flex flex-wrap gap-1.5">
            <span
              v-for="tag in post.tags"
              :key="tag"
              class="rounded-full bg-gray-900/5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300"
            >
              #{{ tag }}
            </span>
          </div>

          <div class="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/10">
            <div class="flex items-center gap-2.5">
              <div class="hdr-avatar !h-9 !w-9">
                {{ initials(post.author) }}
              </div>
              <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ post.author }}</p>
            </div>

            <span class="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300">
              {{ t('app.read') || 'Читать' }}
              <span class="cta-arrow !h-8 !w-8 !bg-blue-500/10">
                <UIcon name="lucide:arrow-up-right" class="h-4 w-4" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>
