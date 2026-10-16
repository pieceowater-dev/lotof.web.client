<template>
  <div class="flex h-full flex-col">
    <div class="p-3 pb-0">
      <div class="at-seg !flex w-full">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          class="at-seg__btn flex-1 justify-center !py-1.5"
          :class="tab === item.key ? 'at-seg__btn--on' : ''"
          @click="tab = item.key"
        >{{ item.label }}</button>
      </div>
    </div>

    <div class="flex-1 space-y-5 overflow-y-auto p-4">
      <!-- PAGE -->
      <template v-if="tab === 'page'">
        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.statusLabel') }}</label>
          <div class="at-seg !flex w-full">
            <button
              v-for="s in statusOptions"
              :key="s.value"
              type="button"
              class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs"
              :class="page.status === s.value ? 'at-seg__btn--on' : ''"
              @click="$emit('update:page', { status: s.value })"
            >{{ s.label }}</button>
          </div>
          <p class="pe-help">{{ t('pages.editor.statusHint') }}</p>
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.addressLabel') }}</label>
          <div v-if="isHome" class="pe-row text-sm text-slate-500 dark:text-neutral-400">
            {{ t('pages.editor.homeAddress') }}
          </div>
          <template v-else>
            <div class="pe-field !flex items-center !gap-0 !p-0 focus-within:!shadow-[inset_0_0_0_2px_rgba(37,99,235,0.6)]">
              <span class="max-w-[55%] flex-shrink-0 truncate pl-4 text-xs text-slate-400">{{ parentPath }}/</span>
              <input
                :value="page.slug"
                type="text"
                class="min-w-0 flex-1 bg-transparent py-2 pl-0.5 pr-4 text-sm outline-none"
                :placeholder="t('pages.editor.slugPlaceholder')"
                @input="onSlug(($event.target as HTMLInputElement).value)"
              />
            </div>
            <p class="pe-help">{{ t('pages.editor.slugHint') }}</p>
          </template>
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.langLabel') }}</label>
          <div class="at-seg !flex w-full">
            <button
              v-for="l in langOptions"
              :key="l.value"
              type="button"
              class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs"
              :class="page.lang === l.value ? 'at-seg__btn--on' : ''"
              @click="$emit('update:page', { lang: l.value })"
            >{{ l.label }}</button>
          </div>
        </section>
      </template>

      <!-- SEO -->
      <template v-else>
        <section class="pe-group">
          <div class="flex items-center justify-between">
            <label class="pe-label">{{ t('pages.editor.metaTitle') }}</label>
            <span class="text-[11px] font-semibold" :class="lenClass(page.metaTitle.length, 30, 60)">{{ page.metaTitle.length }}/60</span>
          </div>
          <input
            :value="page.metaTitle"
            type="text"
            class="pe-field"
            :placeholder="page.title || t('pages.editor.metaTitlePlaceholder')"
            @input="$emit('update:page', { metaTitle: ($event.target as HTMLInputElement).value })"
          />
        </section>

        <section class="pe-group">
          <div class="flex items-center justify-between">
            <label class="pe-label">{{ t('pages.editor.metaDescription') }}</label>
            <span class="text-[11px] font-semibold" :class="lenClass(page.metaDescription.length, 120, 160)">{{ page.metaDescription.length }}/160</span>
          </div>
          <textarea
            :value="page.metaDescription"
            rows="4"
            class="pe-field !resize-none leading-relaxed"
            :placeholder="t('pages.editor.metaDescriptionPlaceholder')"
            @input="$emit('update:page', { metaDescription: ($event.target as HTMLTextAreaElement).value })"
          />
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.ogImage') }}</label>
          <div v-if="page.ogImage" class="group relative overflow-hidden rounded-3xl">
            <img :src="resolveImage(page.ogImage)" alt="" class="h-32 w-full object-cover" />
            <button type="button" class="pe-pill absolute right-2 top-2 !bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 dark:!bg-[#262626]/90" @click="$emit('update:page', { ogImage: '' })">
              {{ t('pages.editor.remove') }}
            </button>
          </div>
          <label class="pe-pill cursor-pointer self-start !px-3.5 !py-2 !text-sm">
            <Icon name="lucide:upload" class="h-4 w-4" />
            <span>{{ page.ogImage ? t('pages.editor.replaceImage') : t('pages.editor.uploadImage') }}</span>
            <input type="file" accept="image/*" class="hidden" @change="onOgFile" />
          </label>
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.canonical') }}</label>
          <input
            :value="page.canonicalPath"
            type="text"
            class="pe-field"
            placeholder="/other-page"
            @input="$emit('update:page', { canonicalPath: ($event.target as HTMLInputElement).value })"
          />
          <p class="pe-help">{{ t('pages.editor.canonicalHint') }}</p>
        </section>

        <section class="pe-row !items-start">
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-800 dark:text-neutral-100">{{ t('pages.editor.noindex') }}</div>
            <p class="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-neutral-500">{{ t('pages.editor.noindexHint') }}</p>
          </div>
          <UToggle :model-value="page.noindex" @update:model-value="$emit('update:page', { noindex: $event })" />
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.checks') }}</label>
          <ul class="space-y-1.5 rounded-3xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.04]">
            <li v-for="c in checks" :key="c.id" class="flex items-center gap-2 text-sm" :class="c.ok ? 'text-slate-700 dark:text-neutral-200' : 'text-slate-400 dark:text-neutral-500'">
              <Icon :name="c.ok ? 'lucide:circle-check' : 'lucide:circle'" class="h-4 w-4 flex-shrink-0" :class="c.ok ? 'text-emerald-500' : 'text-slate-300 dark:text-neutral-600'" />
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
