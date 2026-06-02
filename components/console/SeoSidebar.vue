<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/composables/useI18n'

interface Block {
  type: string
  attrs: Record<string, any>
}

interface Article {
  title: string
  metaTitle: string
  metaDescription: string
  slug: string
  focusKeyword: string
  ogImage: string
}

const props = defineProps<{
  article: Article
  blocks: Block[]
}>()

defineEmits<{
  'update:article': [Partial<Article>]
}>()

const { t } = useI18n()
const config = useRuntimeConfig()

const previewDomain = computed(() => {
  const raw = String(config.public.siteUrl || 'https://lota.tools').trim()
  try {
    return new URL(raw).host
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '') || 'lota.tools'
  }
})

const seoScore = computed(() => {
  let score = 0
  if (props.article.metaTitle) score += 15
  if (props.article.metaTitle.length >= 30 && props.article.metaTitle.length <= 60) score += 15
  if (props.article.metaDescription) score += 15
  if (props.article.metaDescription.length >= 120 && props.article.metaDescription.length <= 160) score += 15
  if (props.article.slug) score += 10
  if (props.article.focusKeyword) score += 10
  if (props.article.focusKeyword && props.article.metaTitle.toLowerCase().includes(props.article.focusKeyword.toLowerCase())) score += 10
  if (props.article.focusKeyword && props.article.metaDescription.toLowerCase().includes(props.article.focusKeyword.toLowerCase())) score += 10
  if (props.blocks.some(b => b.type === 'image' && b.attrs.alt)) score += 10
  return score
})

const seoChecks = computed(() => [
  { id: 'title-filled', ok: !!props.article.metaTitle, label: t('admin.editor.seoCheckMetaTitleFilled') },
  { id: 'title-length', ok: props.article.metaTitle.length >= 30 && props.article.metaTitle.length <= 60, label: t('admin.editor.seoCheckMetaTitleLength') },
  { id: 'desc-filled', ok: !!props.article.metaDescription, label: t('admin.editor.seoCheckMetaDescFilled') },
  { id: 'desc-length', ok: props.article.metaDescription.length >= 120 && props.article.metaDescription.length <= 160, label: t('admin.editor.seoCheckMetaDescLength') },
  { id: 'slug', ok: !!props.article.slug, label: t('admin.editor.seoCheckSlug') },
  { id: 'image-alt', ok: props.blocks.some(b => b.type === 'image' && b.attrs.alt), label: t('admin.editor.seoCheckImageAlt') }
])
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- SEO score card -->
    <div class="p-4 border-b border-slate-100 dark:border-slate-800">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div class="flex items-center gap-3 mb-3">
          <!-- Score circle -->
          <div
            class="h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center text-base font-bold border-2"
            :class="seoScore >= 70
              ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-600'
              : seoScore >= 40
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-600'
              : 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:border-red-600'"
          >{{ seoScore }}</div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">{{ t('admin.editor.seoScore') }}</p>
            <p class="text-xs mt-0.5"
              :class="seoScore >= 70 ? 'text-green-600 dark:text-green-400' : seoScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'"
            >{{ seoScore >= 70 ? t('admin.editor.seoGreat') : seoScore >= 40 ? t('admin.editor.seoImprove') : t('admin.editor.seoNeedsWork') }}</p>
          </div>
        </div>
        <!-- Progress bar -->
        <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="seoScore >= 70 ? 'bg-green-500' : seoScore >= 40 ? 'bg-amber-400' : 'bg-red-500'"
            :style="{ width: seoScore + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Checklist -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{{ t('admin.editor.checklist') }}</p>
        <ConsoleSeoCheckItem
          v-for="check in seoChecks"
          :key="check.id"
          :ok="check.ok"
          :label="check.label"
        />
      </div>

      <!-- Meta fields -->
      <div class="p-4 space-y-4">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{{ t('admin.editor.metaData') }}</p>

        <!-- Focus keyword -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.focusKeyword') }}</label>
          <input
            :value="article.focusKeyword"
            @input="$emit('update:article', { focusKeyword: ($event.target as HTMLInputElement).value })"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.focusKeywordPlaceholder')"
          />
        </div>

        <!-- Slug -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {{ t('admin.editor.urlSlug') }} <span class="text-red-500">*</span>
          </label>
          <div class="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-slate-950">
            <span class="px-2.5 text-xs text-slate-400 border-r border-slate-200 dark:border-slate-700 py-2 bg-slate-50 dark:bg-slate-800 font-mono">/</span>
            <input
              :value="article.slug"
              @input="$emit('update:article', { slug: ($event.target as HTMLInputElement).value })"
              type="text"
              class="flex-1 px-2.5 py-2 text-sm bg-transparent outline-none text-slate-900 dark:text-white font-mono"
              :placeholder="t('admin.editor.urlSlugPlaceholder')"
            />
          </div>
        </div>

        <!-- Meta title -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.editor.metaTitle') }} <span class="text-red-500">*</span></label>
            <span
              class="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              :class="article.metaTitle.length > 60
                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : article.metaTitle.length >= 30
                ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
            >{{ article.metaTitle.length }}/60</span>
          </div>
          <input
            :value="article.metaTitle"
            @input="$emit('update:article', { metaTitle: ($event.target as HTMLInputElement).value })"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.metaTitlePlaceholder')"
            maxlength="80"
          />
        </div>

        <!-- Meta description -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">{{ t('admin.editor.metaDescription') }} <span class="text-red-500">*</span></label>
            <span
              class="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
              :class="article.metaDescription.length > 160
                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                : article.metaDescription.length >= 120
                ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'"
            >{{ article.metaDescription.length }}/160</span>
          </div>
          <textarea
            :value="article.metaDescription"
            @input="$emit('update:article', { metaDescription: ($event.target as HTMLInputElement).value })"
            rows="3"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            :placeholder="t('admin.editor.metaDescPlaceholder')"
            maxlength="200"
          />
        </div>

        <!-- SERP preview -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div class="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <div class="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div class="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div class="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span class="ml-1 text-[10px] text-slate-400 font-medium">{{ t('admin.editor.serpPreview') }}</span>
          </div>
          <div class="p-3 space-y-0.5">
            <p class="text-sm text-blue-600 dark:text-blue-400 font-medium truncate leading-snug">
              {{ article.metaTitle || article.title || t('admin.editor.pageTitleFallback') }}
            </p>
            <p class="text-xs text-green-700 dark:text-green-500 truncate">
              {{ previewDomain }}/{{ article.slug || t('admin.editor.urlSlugPlaceholder') }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {{ article.metaDescription || t('admin.editor.serpDescriptionFallback') }}
            </p>
          </div>
        </div>

        <!-- OG image -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{{ t('admin.editor.ogImage') }}</label>
          <input
            :value="article.ogImage"
            @input="$emit('update:article', { ogImage: ($event.target as HTMLInputElement).value })"
            type="url"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            :placeholder="t('admin.editor.ogImagePlaceholder')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
