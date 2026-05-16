<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Article {
  title: string
  metaDescription?: string
  slug: string
  canonicalUrl?: string
  category: string
  author: string
  authorUrl?: string
  authorRole?: string
  publishedAt: string
  updatedAt?: string
  tags: string[]
  featuredImage?: string
  ogImage?: string
  schemaType: 'Article' | 'NewsArticle' | 'BlogPosting'
  sourceUrl?: string
  sourceName?: string
  reviewedBy?: string
  reviewedByUrl?: string
  reviewedDate?: string
  publisherName?: string
  publisherUrl?: string
  publisherLogo?: string
}

const props = withDefaults(defineProps<{
  article: Article
  embedded?: boolean
}>(), {
  embedded: false,
})

const emit = defineEmits<{
  'update:article': [Partial<Article>]
}>()

const { t } = useI18n()

const schemaTypeOptions: Array<{ value: Article['schemaType']; label: string }> = [
  { value: 'Article', label: t('admin.editor.schemaTypeArticle') },
  { value: 'NewsArticle', label: t('admin.editor.schemaTypeNewsArticle') },
  { value: 'BlogPosting', label: t('admin.editor.schemaTypeBlogPosting') },
]

const prettyJson = computed(() => {
  const authorObj: Record<string, unknown> = {
    '@type': 'Person',
    name: props.article.author || 'Lota Team',
  }

  if (props.article.authorUrl) authorObj.url = props.article.authorUrl
  if (props.article.authorRole) authorObj.jobTitle = props.article.authorRole

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': props.article.schemaType || 'Article',
    url: props.article.canonicalUrl || undefined,
    mainEntityOfPage: props.article.canonicalUrl
      ? { '@type': 'WebPage', '@id': props.article.canonicalUrl }
      : undefined,
    headline: props.article.title || undefined,
    description: props.article.metaDescription || undefined,
    author: authorObj,
    image: [props.article.ogImage || props.article.featuredImage || '/og-image.png'],
    datePublished: props.article.publishedAt || undefined,
    dateModified: props.article.updatedAt || props.article.publishedAt || undefined,
    articleSection: props.article.category || undefined,
    keywords: (props.article.tags || []).join(', ') || undefined,
    publisher: {
      '@type': 'Organization',
      name: props.article.publisherName || 'Lota',
      url: props.article.publisherUrl || undefined,
      logo: {
        '@type': 'ImageObject',
        url: props.article.publisherLogo || '/og-image.png',
      },
    },
  }

  if (props.article.sourceUrl) {
    base.citation = [{
      '@type': 'CreativeWork',
      url: props.article.sourceUrl,
      name: props.article.sourceName || props.article.sourceUrl,
    }]
  }

  if (props.article.reviewedBy) {
    base.reviewedBy = {
      '@type': 'Person',
      name: props.article.reviewedBy,
      url: props.article.reviewedByUrl || undefined,
    }
    base.dateReviewed = props.article.reviewedDate || undefined
  }

  return JSON.stringify(base, null, 2)
})
</script>

<template>
  <div :class="props.embedded ? 'space-y-4' : 'flex flex-col h-full'">
    <div :class="props.embedded ? '' : 'p-4 border-b border-slate-100 dark:border-slate-800'">
      <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">{{ t('admin.editor.schemaType') }}</p>
      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="option in schemaTypeOptions"
          :key="option.value"
          type="button"
          @click="emit('update:article', { schemaType: option.value })"
          :class="[
            'px-3 py-2 rounded-lg border text-left text-xs font-semibold transition-all',
            article.schemaType === option.value
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/25 dark:text-blue-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          ]"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div :class="props.embedded ? 'space-y-4' : 'flex-1 overflow-y-auto p-4 space-y-4'">
      <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{{ t('admin.editor.schemaFields') }}</p>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaCanonicalUrl') }}</label>
        <input
          :value="article.canonicalUrl"
          @input="emit('update:article', { canonicalUrl: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaCanonicalUrlPlaceholder')"
        />
      </div>

      <div class="grid grid-cols-1 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaAuthorUrl') }}</label>
          <input
            :value="article.authorUrl"
            @input="emit('update:article', { authorUrl: ($event.target as HTMLInputElement).value })"
            type="url"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.schemaAuthorUrlPlaceholder')"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaAuthorRole') }}</label>
          <input
            :value="article.authorRole"
            @input="emit('update:article', { authorRole: ($event.target as HTMLInputElement).value })"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.schemaAuthorRolePlaceholder')"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaUpdatedAt') }}</label>
          <input
            :value="article.updatedAt"
            @input="emit('update:article', { updatedAt: ($event.target as HTMLInputElement).value })"
            type="datetime-local"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800" />

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaSourceUrl') }}</label>
        <input
          :value="article.sourceUrl"
          @input="emit('update:article', { sourceUrl: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaSourceUrlPlaceholder')"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaSourceName') }}</label>
        <input
          :value="article.sourceName"
          @input="emit('update:article', { sourceName: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaSourceNamePlaceholder')"
        />
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800" />

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaReviewedBy') }}</label>
        <input
          :value="article.reviewedBy"
          @input="emit('update:article', { reviewedBy: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaReviewedByPlaceholder')"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaReviewedByUrl') }}</label>
        <input
          :value="article.reviewedByUrl"
          @input="emit('update:article', { reviewedByUrl: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaReviewedByUrlPlaceholder')"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaReviewedDate') }}</label>
        <input
          :value="article.reviewedDate"
          @input="emit('update:article', { reviewedDate: ($event.target as HTMLInputElement).value })"
          type="datetime-local"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800" />

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaPublisherName') }}</label>
        <input
          :value="article.publisherName"
          @input="emit('update:article', { publisherName: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaPublisherNamePlaceholder')"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaPublisherUrl') }}</label>
        <input
          :value="article.publisherUrl"
          @input="emit('update:article', { publisherUrl: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaPublisherUrlPlaceholder')"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.schemaPublisherLogo') }}</label>
        <input
          :value="article.publisherLogo"
          @input="emit('update:article', { publisherLogo: ($event.target as HTMLInputElement).value })"
          type="url"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          :placeholder="t('admin.editor.schemaPublisherLogoPlaceholder')"
        />
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800" />

      <div>
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">{{ t('admin.editor.schemaJsonPreview') }}</p>
        <pre class="text-[11px] leading-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 overflow-auto text-slate-700 dark:text-slate-300">{{ prettyJson }}</pre>
      </div>
    </div>
  </div>
</template>
