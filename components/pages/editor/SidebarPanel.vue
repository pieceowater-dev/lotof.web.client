<template>
  <div class="flex h-full flex-col">
    <div class="flex gap-1 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        class="relative flex-1 overflow-hidden rounded-lg py-1.5 text-sm font-semibold transition-all duration-200"
        :class="tab === item.key
          ? 'border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
        @click="tab = item.key"
      >{{ item.label }}</button>
    </div>

    <div class="flex-1 space-y-6 overflow-y-auto p-4">
      <!-- PAGE -->
      <template v-if="tab === 'page'">
        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.statusLabel') }}</label>
          <div class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              v-for="s in statusOptions"
              :key="s.value"
              type="button"
              class="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all"
              :class="page.status === s.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'"
              @click="$emit('update:page', { status: s.value })"
            >{{ s.label }}</button>
          </div>
          <p class="text-xs leading-relaxed text-slate-400 dark:text-slate-500">{{ t('pages.editor.statusHint') }}</p>
        </section>

        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.addressLabel') }}</label>
          <div v-if="isHome" class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            {{ t('pages.editor.homeAddress') }}
          </div>
          <template v-else>
            <div class="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900">
              <span class="max-w-[55%] flex-shrink-0 truncate pl-3 text-xs text-slate-400">{{ parentPath }}/</span>
              <input
                :value="page.slug"
                type="text"
                class="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none dark:text-slate-200"
                :placeholder="t('pages.editor.slugPlaceholder')"
                @input="onSlug(($event.target as HTMLInputElement).value)"
              />
            </div>
            <p class="text-xs leading-relaxed text-slate-400 dark:text-slate-500">{{ t('pages.editor.slugHint') }}</p>
          </template>
        </section>

        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.langLabel') }}</label>
          <div class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              v-for="l in langOptions"
              :key="l.value"
              type="button"
              class="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all"
              :class="page.lang === l.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'"
              @click="$emit('update:page', { lang: l.value })"
            >{{ l.label }}</button>
          </div>
        </section>
      </template>

      <!-- SEO -->
      <template v-else>
        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.metaTitle') }}</label>
            <span class="text-[11px]" :class="lenClass(page.metaTitle.length, 30, 60)">{{ page.metaTitle.length }}/60</span>
          </div>
          <input
            :value="page.metaTitle"
            type="text"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            :placeholder="page.title || t('pages.editor.metaTitlePlaceholder')"
            @input="$emit('update:page', { metaTitle: ($event.target as HTMLInputElement).value })"
          />
        </section>

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.metaDescription') }}</label>
            <span class="text-[11px]" :class="lenClass(page.metaDescription.length, 120, 160)">{{ page.metaDescription.length }}/160</span>
          </div>
          <textarea
            :value="page.metaDescription"
            rows="4"
            class="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            :placeholder="t('pages.editor.metaDescriptionPlaceholder')"
            @input="$emit('update:page', { metaDescription: ($event.target as HTMLTextAreaElement).value })"
          />
        </section>

        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.ogImage') }}</label>
          <div v-if="page.ogImage" class="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <img :src="resolveImage(page.ogImage)" alt="" class="h-32 w-full object-cover" />
            <button
              type="button"
              class="absolute right-2 top-2 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300"
              @click="$emit('update:page', { ogImage: '' })"
            >{{ t('pages.editor.remove') }}</button>
          </div>
          <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Icon name="lucide:upload" class="h-4 w-4" />
            <span>{{ page.ogImage ? t('pages.editor.replaceImage') : t('pages.editor.uploadImage') }}</span>
            <input type="file" accept="image/*" class="hidden" @change="onOgFile" />
          </label>
        </section>

        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.canonical') }}</label>
          <input
            :value="page.canonicalPath"
            type="text"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder="/other-page"
            @input="$emit('update:page', { canonicalPath: ($event.target as HTMLInputElement).value })"
          />
          <p class="text-xs leading-relaxed text-slate-400 dark:text-slate-500">{{ t('pages.editor.canonicalHint') }}</p>
        </section>

        <section class="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ t('pages.editor.noindex') }}</div>
            <p class="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">{{ t('pages.editor.noindexHint') }}</p>
          </div>
          <UToggle :model-value="page.noindex" @update:model-value="$emit('update:page', { noindex: $event })" />
        </section>

        <section class="space-y-2">
          <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{{ t('pages.editor.checks') }}</label>
          <ul class="space-y-1.5">
            <li v-for="c in checks" :key="c.id" class="flex items-center gap-2 text-sm" :class="c.ok ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'">
              <Icon :name="c.ok ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" :class="c.ok ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'" />
              {{ c.label }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { slugifyText } from '@/utils/pagesSite'

interface PageState {
  title: string; slug: string; status: string; lang: string
  metaTitle: string; metaDescription: string; canonicalPath: string; ogImage: string; noindex: boolean
}

const props = defineProps<{
  page: PageState
  blocks: { type: string; attrs: Record<string, any> }[]
  isHome: boolean
  parentPath: string
  resolveImage: (src: string) => string
}>()

const emit = defineEmits<{
  'update:page': [Partial<PageState>]
  'upload-og-image': [File]
}>()

const { t } = useI18n()
const tab = ref<'page' | 'seo'>('page')
const tabs = computed(() => [
  { key: 'page' as const, label: t('pages.editor.tabPage') },
  { key: 'seo' as const, label: t('pages.editor.tabSeo') },
])
const statusOptions = computed(() => [
  { value: 'ready', label: t('pages.status.ready') },
  { value: 'draft', label: t('pages.status.draft') },
])
const langOptions = computed(() => [
  { value: '', label: t('pages.editor.langAuto') },
  { value: 'ru', label: 'RU' },
  { value: 'kk', label: 'KK' },
  { value: 'en', label: 'EN' },
])

const checks = computed(() => [
  { id: 'title', ok: !!props.page.metaTitle || !!props.page.title, label: t('pages.editor.checkTitle') },
  { id: 'desc', ok: props.page.metaDescription.length >= 50, label: t('pages.editor.checkDescription') },
  { id: 'alt', ok: props.blocks.filter(b => b.type === 'image').every(b => !!b.attrs?.alt), label: t('pages.editor.checkAlt') },
  { id: 'h2', ok: props.blocks.some(b => b.type === 'h2' || b.type === 'h3'), label: t('pages.editor.checkHeadings') },
])

function lenClass(len: number, min: number, max: number) {
  if (!len) return 'text-slate-400'
  return len >= min && len <= max ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
}

function onSlug(value: string) {
  emit('update:page', { slug: slugifyText(value, 100) })
}

function onOgFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload-og-image', file)
  input.value = ''
}
</script>
