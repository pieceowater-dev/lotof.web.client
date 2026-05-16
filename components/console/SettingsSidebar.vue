<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Article {
  status: 'draft' | 'published'
  category: string
  author: string
  authorUrl?: string
  authorRole?: string
  publishedAt: string
  updatedAt?: string
  featuredImage: string
  tags: string[]
  focusKeyword?: string
  canonicalUrl?: string
  schemaType?: 'Article' | 'NewsArticle' | 'BlogPosting'
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
  title?: string
}

const props = defineProps<{
  article: Article
}>()

const emit = defineEmits<{
  'update:article': [Partial<Article>]
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
</script>

<template>
  <!-- Settings tab content -->
  <div class="flex flex-col h-full">
    <!-- Fields -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Category -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.category') }}</label>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="cat in [
              { value: '', label: t('admin.editor.categoryNone'), icon: 'lucide:circle' },
              { value: 'blog', label: t('admin.blog'), icon: 'lucide:notebook-pen' },
              { value: 'whatsnew', label: t('admin.whatsnew'), icon: 'lucide:sparkles' },
              { value: 'articles', label: t('admin.articles'), icon: 'lucide:file-text' },
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

      <!-- Author -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.author') }}</label>
        <input
          :value="article.author"
          @input="$emit('update:article', { author: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.authorPlaceholder')"
        />
      </div>

      <!-- Publish date -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.publishDate') }}</label>
        <input
          :value="article.publishedAt"
          @input="$emit('update:article', { publishedAt: ($event.target as HTMLInputElement).value })"
          type="datetime-local"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
        <input
          :value="article.featuredImage"
          @input="$emit('update:article', { featuredImage: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.featuredImagePlaceholder')"
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
