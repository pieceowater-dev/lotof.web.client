<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { HomeFeedPost } from '@/components/ui/HomePostsFeed.vue';

const { t } = useI18n();

defineProps<{ posts: HomeFeedPost[] }>();
const emit = defineEmits<{ open: [post: HomeFeedPost]; all: [] }>();

const broken = ref<Record<string, boolean>>({});
</script>

<template>
  <section v-if="posts.length" class="mb-10" aria-label="News">
    <div class="sec-head">
      <div class="flex items-center gap-3">
        <span class="icon-tile !h-9 !w-9 !rounded-xl"><UIcon name="lucide:radio" class="h-[18px] w-[18px]" /></span>
        <h2 class="sec-title">{{ t('app.news') || 'Новости' }}</h2>
      </div>
      <button type="button" class="sec-link group" @click="emit('all')">
        {{ t('app.allNews') || 'Все новости' }}
        <span class="cta-arrow !h-7 !w-7 !bg-blue-500/10"><UIcon name="lucide:arrow-right" class="h-3.5 w-3.5" /></span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
      <article
        v-for="(post, idx) in posts"
        :key="post.id"
        class="bezel bezel-hover group cursor-pointer"
        role="button"
        tabindex="0"
        @click="emit('open', post)"
        @keydown.enter="emit('open', post)"
      >
        <div class="bezel-core flex h-full flex-col overflow-hidden">
          <div class="relative overflow-hidden">
            <img
              v-if="post.image && !broken[post.id]"
              :src="post.image"
              :alt="post.imageAlt"
              class="h-48 w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03] sm:h-52"
              :loading="idx === 0 ? 'eager' : 'lazy'"
              decoding="async"
              width="1200"
              height="630"
              @error="broken[post.id] = true"
            />
            <div v-else class="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-300 dark:bg-white/10 dark:text-gray-600 sm:h-52">
              <UIcon name="lucide:newspaper" class="h-10 w-10" />
            </div>
            <span class="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 shadow-sm dark:bg-black/60 dark:text-gray-100">
              {{ post.category }}
            </span>
          </div>

          <div class="flex flex-1 flex-col p-5">
            <div class="mb-2 text-xs font-medium text-gray-400 dark:text-gray-500">{{ post.publishedAt }}</div>
            <h3 class="text-lg font-extrabold leading-snug tracking-tight text-gray-900 dark:text-white">{{ post.title }}</h3>
            <p class="mt-2 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ post.excerpt }}</p>
            <span class="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-blue-600 dark:text-blue-300">
              {{ t('app.read') || 'Читать' }}
              <span class="cta-arrow !h-7 !w-7 !bg-blue-500/10"><UIcon name="lucide:arrow-up-right" class="h-3.5 w-3.5" /></span>
            </span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
