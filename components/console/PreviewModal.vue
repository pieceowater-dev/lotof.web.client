<script setup lang="ts">
import { Icon } from '#components'

interface Block {
  type: string
  content: string
  attrs: Record<string, any>
}

interface Article {
  title: string
  metaDescription: string
  featuredImage: string
  author: string
  publishedAt: string
}

defineProps<{
  open: boolean
  article: Article
  blocks: Block[]
}>()

defineEmits<{
  'update:open': [boolean]
}>()

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function calloutIcon(type: string): string {
  const icons: Record<string, string> = {
    info: 'lucide:info',
    warning: 'lucide:alert-circle',
    success: 'lucide:check-circle-2',
    error: 'lucide:x-circle'
  }
  return icons[type] || icons.info
}

function calloutClass(type: string): string {
  const classes: Record<string, string> = {
    info: 'bg-blue-50 border-l-4 border-blue-500',
    warning: 'bg-amber-50 border-l-4 border-amber-500',
    success: 'bg-green-50 border-l-4 border-green-500',
    error: 'bg-red-50 border-l-4 border-red-500'
  }
  return classes[type] || classes.info
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-white dark:bg-slate-950 overflow-y-auto"
    >
      <!-- Preview Header -->
      <div class="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Превью публикации</h2>
        <button
          @click="$emit('update:open', false)"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="lucide:x" class="h-5 w-5" />
        </button>
      </div>

      <!-- Preview Content -->
      <main class="max-w-3xl mx-auto py-12 px-6 dark:text-slate-200">
        <!-- Featured image -->
        <img
          v-if="article.featuredImage"
          :src="article.featuredImage"
          :alt="article.title"
          class="w-full h-96 object-cover rounded-2xl mb-8"
        />

        <!-- Meta info -->
        <div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mb-6">
          <div v-if="article.author" class="flex items-center gap-2">
            <Icon name="lucide:user" class="h-4 w-4" />
            {{ article.author }}
          </div>
          <div v-if="article.publishedAt" class="flex items-center gap-2">
            <Icon name="lucide:calendar" class="h-4 w-4" />
            {{ formatDate(article.publishedAt) }}
          </div>
        </div>

        <!-- Title -->
        <h1 class="text-5xl font-bold mb-6 text-slate-900 dark:text-white leading-tight">
          {{ article.title }}
        </h1>

        <!-- Description -->
        <p v-if="article.metaDescription" class="text-xl text-slate-600 dark:text-slate-400 mb-8 font-light">
          {{ article.metaDescription }}
        </p>

        <!-- Divider -->
        <div class="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent my-8" />

        <!-- Content blocks -->
        <article class="prose dark:prose-invert max-w-none space-y-6">
          <template v-for="(block, i) in blocks" :key="i">
            <!-- Paragraph -->
            <p v-if="block.type === 'paragraph'" class="text-lg leading-8 text-slate-700 dark:text-slate-300">
              {{ block.content }}
            </p>

            <!-- Headings -->
            <h2 v-else-if="block.type === 'h2'" class="text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">
              {{ block.content }}
            </h2>
            <h3 v-else-if="block.type === 'h3'" class="text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-white">
              {{ block.content }}
            </h3>
            <h4 v-else-if="block.type === 'h4'" class="text-xl font-bold mt-4 mb-2 text-slate-900 dark:text-white">
              {{ block.content }}
            </h4>
            <h5 v-else-if="block.type === 'h5'" class="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white">
              {{ block.content }}
            </h5>

            <!-- Quote -->
            <blockquote v-else-if="block.type === 'quote'" class="border-l-4 border-slate-300 dark:border-slate-700 pl-6 py-3 italic text-slate-600 dark:text-slate-400 my-6">
              {{ block.content }}
            </blockquote>

            <!-- Lists -->
            <ul v-else-if="block.type === 'ul'" class="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
              <li v-for="item in block.content.split('\n').filter(l => l.trim())" :key="item">
                {{ item.replace(/^[•\-*]\s*/, '') }}
              </li>
            </ul>
            <ol v-else-if="block.type === 'ol'" class="list-decimal list-inside space-y-2 text-slate-700 dark:text-slate-300">
              <li v-for="item in block.content.split('\n').filter(l => l.trim())" :key="item">
                {{ item.replace(/^\d+\.\s*/, '') }}
              </li>
            </ol>

            <!-- Image -->
            <figure v-else-if="block.type === 'image'" class="my-8">
              <img
                v-if="block.attrs.url"
                :src="block.attrs.url"
                :alt="block.attrs.alt"
                class="w-full rounded-lg"
              />
              <figcaption v-if="block.attrs.alt" class="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
                {{ block.attrs.alt }}
              </figcaption>
            </figure>

            <!-- Callout -->
            <div
              v-else-if="block.type === 'callout'"
              :class="['p-4 rounded-lg', calloutClass(block.attrs.type || 'info')]"
            >
              <div class="flex items-start gap-3">
                <Icon
                  :name="calloutIcon(block.attrs.type || 'info')"
                  class="h-5 w-5 mt-0.5 flex-shrink-0"
                  :class="{
                    'text-blue-600': block.attrs.type === 'info',
                    'text-amber-600': block.attrs.type === 'warning',
                    'text-green-600': block.attrs.type === 'success',
                    'text-red-600': block.attrs.type === 'error'
                  }"
                />
                <p class="text-sm leading-6">{{ block.content }}</p>
              </div>
            </div>

            <!-- Spoiler -->
            <details v-else-if="block.type === 'spoiler'" class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <summary class="cursor-pointer list-none font-semibold text-slate-800 dark:text-slate-100">
                Защищенный текст
              </summary>
              <div class="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {{ block.content }}
              </div>
            </details>

            <!-- Spoiler Open -->
            <div v-else-if="block.type === 'spoiler_open'" class="my-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              [Spoiler Open] Защищенный текст
            </div>

            <!-- Spoiler Close -->
            <div v-else-if="block.type === 'spoiler_close'" class="my-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              [Spoiler Close]
            </div>

            <!-- Divider -->
            <div v-else-if="block.type === 'divider'" class="flex items-center justify-center gap-2 py-6 text-slate-300 dark:text-slate-700">
              <span>·</span><span>·</span><span>·</span>
            </div>

            <!-- HTML (raw render - be careful!) -->
            <div v-else-if="block.type === 'html'" class="my-6" v-html="block.content" />
          </template>
        </article>
      </main>
    </div>
  </Teleport>
</template>

<style scoped>
.prose {
  @apply text-slate-700 dark:text-slate-300;
}

.prose h1,
.prose h2,
.prose h3 {
  @apply text-slate-900 dark:text-white;
}

.prose a {
  @apply text-blue-600 dark:text-blue-400 hover:underline;
}

.prose strong {
  @apply font-semibold;
}

.prose em {
  @apply italic;
}

.prose code {
  @apply bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sm font-mono;
}

.prose pre {
  @apply bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto;
}
</style>
