<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Article {
  title: string
  slug: string
  status: 'draft' | 'published'
  category: string
  author: string
  authorUrl?: string
  authorRole?: string
  publishedAt: string
  updatedAt?: string
  featuredImage: string
  featuredImageAlt?: string
  tags: string[]
  focusKeyword?: string
  canonicalUrl?: string
  schemaType: 'Article' | 'NewsArticle' | 'BlogPosting'
  sourceUrl?: string
  sourceName?: string
  reviewedBy?: string
  reviewedByUrl?: string
  reviewedDate?: string
  publisherName?: string
  publisherUrl?: string
  publisherLogo?: string
  metaDescription?: string
  ogImage?: string
}

const props = defineProps<{
  article: Article
}>()

const emit = defineEmits<{
  'update:article': [Partial<Article>]
  'upload-featured-image': [File]
  clear: []
  'add-block': []
}>()

const { t } = useI18n()
const newTag = ref('')

function addTag() {
  const tag = newTag.value.trim()
  if (!tag) return
  if (props.article.tags.includes(tag)) {
    newTag.value = ''
    return
  }
  emit('update:article', { tags: [...props.article.tags, tag] })
  newTag.value = ''
}

function removeTag(index: number) {
  emit('update:article', { tags: props.article.tags.filter((_, i) => i !== index) })
}

function onFeaturedImageFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('upload-featured-image', file)
  input.value = ''
}
</script>

<template>
  <!-- Settings tab content -->
  <div class="flex flex-col h-full">
    <!-- Fields -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
      <!-- Category -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {{ t('admin.editor.category') }} <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="cat in [
              { value: 'blog', label: t('admin.blog'), icon: 'lucide:notebook-pen' },
              { value: 'whatsnew', label: t('admin.whatsnew'), icon: 'lucide:sparkles' },
              { value: 'articles', label: t('admin.articles'), icon: 'lucide:file-text' },
              { value: 'news', label: t('app.news') || 'Новости', icon: 'lucide:newspaper' },
              { value: 'learning', label: t('admin.learning'), icon: 'lucide:graduation-cap' }
            ]"
            :key="cat.value || 'none'"
            type="button"
            @click="$emit('update:article', { category: cat.value })"
            :class="[
              'min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs font-medium transition-all',
              article.category === cat.value
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/25 dark:text-blue-300 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            ]"
          >
            <Icon :name="cat.icon" class="h-3.5 w-3.5 flex-shrink-0" />
            <span class="truncate">{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <!-- Publish date -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {{ t('admin.editor.publishDate') }} <span class="text-red-500">*</span>
        </label>
        <input
          :value="article.publishedAt"
          @input="$emit('update:article', { publishedAt: ($event.target as HTMLInputElement).value })"
          type="datetime-local"
          class="w-full min-w-0 max-w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Tags -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.tags') }}</label>
        <div class="flex gap-1.5 mb-2 flex-wrap">
          <span
            v-for="(tag, i) in article.tags"
            :key="i"
            class="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium flex items-center gap-1"
          >
            {{ tag }}
            <button @click="removeTag(i)" class="opacity-60 hover:opacity-100">
              <Icon name="lucide:x" class="h-3 w-3" />
            </button>
          </span>
        </div>
        <div class="flex gap-1.5">
          <input
            v-model="newTag"
            type="text"
            class="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.tagPlaceholder')"
            @keyup.enter="addTag"
          />
          <button
            @click="addTag"
            class="px-2.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <!-- Featured image -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.featuredImage') }}</label>
        <div class="mb-2">
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <Icon name="lucide:upload" class="h-3.5 w-3.5" />
            Загрузить файл
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFeaturedImageFileChange"
            />
          </label>
        </div>
        <div
          v-if="article.featuredImage"
          class="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <img
            :src="article.featuredImage"
            alt="Featured preview"
            class="h-12 w-12 rounded-md object-cover border border-slate-200 dark:border-slate-700"
            loading="lazy"
          />
          <span class="text-[11px] text-slate-500 dark:text-slate-400">Превью</span>
        </div>

        <div class="mt-2">
          <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
            Alt текст главной картинки
          </label>
          <input
            :value="article.featuredImageAlt || ''"
            @input="$emit('update:article', { featuredImageAlt: ($event.target as HTMLInputElement).value })"
            type="text"
            placeholder="Описание изображения для доступности и SEO"
            class="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <!-- Author (grouped with schema-related metadata) -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {{ t('admin.editor.author') }} <span class="text-red-500">*</span>
        </label>
        <input
          :value="article.author"
          @input="$emit('update:article', { author: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.authorPlaceholder')"
        />
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
        <ConsoleSchemaSidebar
          :article="article"
          embedded
          @update:article="$emit('update:article', $event)"
        />
      </div>
    </div>

    <!-- Add block button -->
    <div class="p-4 border-t border-slate-100 dark:border-slate-800">
      <button
        @click="$emit('add-block')"
        class="w-full px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1.5"
      >
        <Icon name="lucide:plus" class="h-4 w-4" />
        {{ t('admin.editor.addBlock') }}
      </button>
    </div>

    <!-- Clear all button -->
    <div class="p-4 border-t border-slate-100 dark:border-slate-800">
      <button
        @click="$emit('clear')"
        class="w-full px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
      >
        {{ t('admin.editor.clearAll') }}
      </button>
    </div>
  </div>
</template>
