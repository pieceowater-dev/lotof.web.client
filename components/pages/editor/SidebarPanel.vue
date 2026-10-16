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

        <section v-if="!isHome && canMove" class="pe-group">
          <label class="pe-label">{{ t('pages.editor.parentLabel') }}</label>
          <PagesPagePicker v-model="parentSel" :ns-slug="nsSlug || ''" :site-id="siteId || ''" :exclude="exclude" />
          <label class="pe-label mt-2">{{ t('pages.editor.orderLabel') }}</label>
          <input v-model.number="orderSel" type="number" class="pe-field" />
          <p class="pe-help">{{ t('pages.editor.attributesHint') }}</p>
          <button type="button" class="at-btn at-btn--blue mt-1 self-start" :disabled="!placementChanged || moving" @click="applyMove">
            <Icon :name="moving ? 'lucide:loader-2' : 'lucide:move'" class="h-4 w-4" :class="moving ? 'animate-spin' : ''" />{{ t('pages.editor.applyMove') }}
          </button>
        </section>

        <section v-if="canTranslate" class="pe-group">
          <label class="pe-label">{{ t('pages.editor.translations') }}</label>
          <div class="flex flex-col gap-1.5">
            <div v-for="r in langRows" :key="r.lang" class="flex items-center gap-2 rounded-2xl px-3 py-2 ring-1 ring-black/5 dark:ring-white/10" :class="r.page?.id === undefined ? '' : 'bg-gray-50 dark:bg-white/5'">
              <span class="w-8 flex-shrink-0 text-xs font-bold uppercase text-slate-500 dark:text-neutral-400">{{ r.lang }}</span>
              <template v-if="r.page">
                <button type="button" class="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:underline dark:text-white" @click="emit('open-page', r.page.id)">{{ r.page.path }}</button>
                <span class="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="r.page.status === 'PAGE_READY' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">{{ r.page.status === 'PAGE_READY' ? t('pages.status.ready') : t('pages.status.draft') }}</span>
              </template>
              <template v-else>
                <span class="min-w-0 flex-1 text-sm text-slate-400">{{ t('pages.editor.noTranslation') }}</span>
                <button type="button" class="at-btn !px-2.5 !py-1 text-xs" :disabled="translating === r.lang" @click="translateTo(r.lang)">
                  <Icon :name="translating === r.lang ? 'lucide:loader-2' : 'lucide:languages'" class="h-3.5 w-3.5" :class="translating === r.lang ? 'animate-spin' : ''" />{{ t('pages.editor.createTranslation') }}
                </button>
              </template>
            </div>
          </div>
          <p class="pe-help">{{ t('pages.editor.translationsHint') }}</p>
        </section>

        <section v-if="canCategories" class="pe-group">
          <label class="pe-label">{{ t('pages.categories.title2') }}</label>
          <PagesCategoryChips v-model="catSel" :categories="categories || []" />
          <p class="pe-help">{{ t('pages.editor.categoriesHint') }}</p>
          <button v-if="catsChanged" type="button" class="at-btn at-btn--blue mt-1 self-start" :disabled="catSaving" @click="applyCategories">
            <Icon :name="catSaving ? 'lucide:loader-2' : 'lucide:check'" class="h-4 w-4" :class="catSaving ? 'animate-spin' : ''" />{{ t('pages.editor.applyCategories') }}
          </button>
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

      <!-- POST: blog meta, schedule, layout -->
      <template v-else-if="tab === 'post'">
        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.post.kind') }}</label>
          <div class="at-seg !flex w-full">
            <button v-for="k in kindOptions" :key="k.value" type="button" class="at-seg__btn flex-1 justify-center !px-2 !py-1.5 !text-xs" :class="(page.kind || '') === k.value ? 'at-seg__btn--on' : ''" @click="$emit('update:page', { kind: k.value })">{{ k.label }}</button>
          </div>
          <p class="pe-help">{{ t('pages.editor.post.kindHint') }}</p>
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.post.schedule') }}</label>
          <template v-if="page.status === 'ready'">
            <div class="flex items-center gap-2">
              <input type="datetime-local" class="pe-field min-w-0 flex-1" :value="publishAtLocal" :min="nowLocal" @change="onPublishAt(($event.target as HTMLInputElement).value)" />
              <button v-if="page.publishAt" type="button" class="pe-pill flex-shrink-0" @click="$emit('update:page', { publishAt: 0 })">{{ t('pages.editor.remove') }}</button>
            </div>
            <p class="pe-help">{{ page.publishAt ? t('pages.editor.post.scheduleOn') : t('pages.editor.post.scheduleHint') }}</p>
          </template>
          <p v-else class="pe-help">{{ t('pages.editor.post.scheduleNeedsReady') }}</p>
        </section>

        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.post.layout') }}</label>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="l in layoutOptions" :key="l.value" type="button" class="pe-pill" :class="(page.layout || '') === l.value ? 'pe-pill--on' : ''" @click="$emit('update:page', { layout: l.value })">{{ l.label }}</button>
          </div>
          <p class="pe-help">{{ t('pages.editor.post.layoutHint') }}</p>
        </section>

        <template v-if="page.kind === 'post' || page.kind === 'news'">
          <section class="pe-group">
            <label class="pe-label">{{ t('pages.editor.post.tags') }}</label>
            <div v-if="page.tags.length" class="flex flex-wrap gap-1.5">
              <button v-for="tg in page.tags" :key="tg" type="button" class="pe-pill pe-pill--on" :title="t('pages.editor.remove')" @click="removeTag(tg)">{{ tg }}<Icon name="lucide:x" class="h-3 w-3" /></button>
            </div>
            <input v-model="tagDraft" type="text" class="pe-field" maxlength="40" :placeholder="t('pages.editor.post.tagPlaceholder')" @keydown.enter.prevent="addTag(tagDraft)" @keydown="onTagKey" @blur="addTag(tagDraft)" />
            <div v-if="tagPicks.length" class="flex flex-wrap gap-1.5">
              <button v-for="tg in tagPicks" :key="tg" type="button" class="pe-pill" @click="addTag(tg)">+ {{ tg }}</button>
            </div>
            <p class="pe-help">{{ t('pages.editor.post.tagsHint') }}</p>
          </section>

          <section class="pe-group">
            <div class="flex items-center justify-between">
              <label class="pe-label">{{ t('pages.editor.post.excerpt') }}</label>
              <span class="text-[11px] font-semibold text-slate-400">{{ page.excerpt.length }}/300</span>
            </div>
            <textarea :value="page.excerpt" rows="3" maxlength="300" class="pe-field !resize-none leading-relaxed" :placeholder="t('pages.editor.post.excerptPlaceholder')" @input="$emit('update:page', { excerpt: ($event.target as HTMLTextAreaElement).value })" />
          </section>

          <section class="pe-group">
            <label class="pe-label">{{ t('pages.editor.post.featured') }}</label>
            <div v-if="page.featuredImage" class="group relative overflow-hidden rounded-3xl">
              <img :src="resolveImage(page.featuredImage)" alt="" class="h-32 w-full object-cover" />
              <button type="button" class="pe-pill absolute right-2 top-2 !bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 dark:!bg-[#262626]/90" @click="$emit('update:page', { featuredImage: '' })">{{ t('pages.editor.remove') }}</button>
            </div>
            <label class="pe-pill cursor-pointer self-start !px-3.5 !py-2 !text-sm">
              <Icon name="lucide:upload" class="h-4 w-4" />
              <span>{{ page.featuredImage ? t('pages.editor.replaceImage') : t('pages.editor.uploadImage') }}</span>
              <input type="file" accept="image/*" class="hidden" @change="onFeaturedFile" />
            </label>
          </section>

          <section class="pe-group">
            <label class="pe-label">{{ t('pages.editor.post.author') }}</label>
            <input :value="page.author" type="text" class="pe-field" maxlength="80" :placeholder="t('pages.editor.post.authorPlaceholder')" @input="$emit('update:page', { author: ($event.target as HTMLInputElement).value })" />
          </section>

          <section class="pe-row !items-start">
            <div class="min-w-0">
              <div class="text-sm font-bold text-slate-800 dark:text-neutral-100">{{ t('pages.editor.post.pinned') }}</div>
              <p class="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-neutral-500">{{ t('pages.editor.post.pinnedHint') }}</p>
            </div>
            <UToggle :model-value="page.pinned" @update:model-value="$emit('update:page', { pinned: $event })" />
          </section>
        </template>
      </template>

      <!-- SEO -->
      <template v-else>
        <section class="pe-group">
          <label class="pe-label">{{ t('pages.editor.snippet') }}</label>
          <div class="rounded-3xl bg-white p-3.5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-[#1f1f1f] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]">
            <div class="truncate text-[11px] text-slate-500 dark:text-neutral-400">{{ snippetUrl }}</div>
            <div class="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-blue-700 dark:text-blue-300">{{ snippetTitle }}</div>
            <div class="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-neutral-300">{{ snippetDesc }}</div>
          </div>
          <p class="pe-help">{{ t('pages.editor.snippetHint') }}</p>
        </section>

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
import { computed, ref, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'
import { slugifyText } from '@/utils/pagesSite'

interface PageState {
  title: string; slug: string; status: string; lang: string
  metaTitle: string; metaDescription: string; canonicalPath: string; ogImage: string; noindex: boolean
  kind: string; tags: string[]; excerpt: string; featuredImage: string; author: string; pinned: boolean; layout: string; publishAt: number
}

const props = defineProps<{
  page: PageState
  blocks: { type: string; attrs: Record<string, any> }[]
  isHome: boolean
  parentPath: string
  nsSlug?: string
  siteId?: string
  exclude?: Set<string>
  parentId?: string
  sort?: number
  canMove?: boolean
  categories?: any[]
  categoryIds?: string[]
  canCategories?: boolean
  translations?: { id: string; lang: string; path: string; status: string }[]
  siteLangs?: string[]
  canTranslate?: boolean
  resolveImage: (src: string) => string
  tagSuggestions?: string[]
  siteName?: string
  siteHost?: string
}>()

const emit = defineEmits<{
  'update:page': [Partial<PageState>]
  'upload-og-image': [File]
  'upload-featured': [File]
  move: [string, number]
  categories: [string[]]
  translate: [string]
  'open-page': [string]
}>()

const { t } = useI18n()

const parentSel = ref(props.parentId || '')
const orderSel = ref(props.sort || 0)
const moving = ref(false)
const placementChanged = computed(() => parentSel.value !== (props.parentId || '') || Number(orderSel.value) !== (props.sort || 0))
watch(() => [props.parentId, props.sort], () => { parentSel.value = props.parentId || ''; orderSel.value = props.sort || 0 })
function applyMove() {
  moving.value = true
  emit('move', parentSel.value, Number(orderSel.value) || 0)
  setTimeout(() => { moving.value = false }, 900)
}
const catSel = ref<string[]>([...(props.categoryIds || [])])
const catSaving = ref(false)
const catsChanged = computed(() => {
  const a = [...catSel.value].sort().join(',')
  const b = [...(props.categoryIds || [])].sort().join(',')
  return a !== b
})
watch(() => props.categoryIds, (v) => { catSel.value = [...(v || [])] })
function applyCategories() {
  catSaving.value = true
  emit('categories', [...catSel.value])
  setTimeout(() => { catSaving.value = false }, 900)
}
const ALL_LANGS = ['ru', 'kk', 'en']
const translating = ref('')
// languages worth offering: the site's own plus the usual ones, minus those the page group already covers
const langRows = computed(() => {
  const have = new Map((props.translations || []).map(x => [x.lang.toLowerCase(), x]))
  const wanted = Array.from(new Set([...(props.siteLangs || []), ...ALL_LANGS].map(l => l.toLowerCase())))
  return wanted.map(l => ({ lang: l, page: have.get(l) || null }))
})
function translateTo(lang: string) {
  translating.value = lang
  emit('translate', lang)
  setTimeout(() => { translating.value = '' }, 1500)
}
const tab = ref<'page' | 'post' | 'seo'>('page')
const tabs = computed(() => [
  { key: 'page' as const, label: t('pages.editor.tabPage') },
  { key: 'post' as const, label: t('pages.editor.tabPost') },
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

// ── post tab ──
const kindOptions = computed(() => [
  { value: '', label: t('pages.editor.post.kindPage') },
  { value: 'post', label: t('pages.editor.post.kindPost') },
  { value: 'news', label: t('pages.editor.post.kindNews') },
])
const layoutOptions = computed(() => ['', 'wide', 'narrow', 'sidebar', 'bare'].map(v => ({ value: v, label: t(`pages.blog.layout.${v || 'default'}`) })))
const tagDraft = ref('')
function addTag(raw: string) {
  const tag = raw.replace(/[<>"/\\,]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 40)
  tagDraft.value = ''
  if (!tag || props.page.tags.length >= 20 || props.page.tags.some(x => x.toLowerCase() === tag.toLowerCase())) return
  emit('update:page', { tags: [...props.page.tags, tag] })
}
function onTagKey(e: KeyboardEvent) {
  if (e.key === ',') { e.preventDefault(); addTag(tagDraft.value) }
}
function removeTag(tag: string) { emit('update:page', { tags: props.page.tags.filter(x => x !== tag) }) }
const tagPicks = computed(() => (props.tagSuggestions || []).filter(x => !props.page.tags.some(y => y.toLowerCase() === x.toLowerCase())).slice(0, 10))
const pad = (n: number) => String(n).padStart(2, '0')
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const publishAtLocal = computed(() => (props.page.publishAt ? toLocal(new Date(props.page.publishAt * 1000)) : ''))
const nowLocal = computed(() => toLocal(new Date()))
function onPublishAt(v: string) {
  const ms = v ? new Date(v).getTime() : 0
  emit('update:page', { publishAt: ms > Date.now() ? Math.floor(ms / 1000) : 0 })
}
function onFeaturedFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload-featured', file)
  input.value = ''
}

// ── how the page looks in a Google result ──
const snippetUrl = computed(() => {
  const host = props.siteHost || 'site.example'
  const path = props.isHome ? '' : `${props.parentPath || ''}/${props.page.slug || ''}`
  return `${host}${path ? ' › ' + path.replace(/^\//, '').split('/').join(' › ') : ''}`
})
const snippetTitle = computed(() => {
  const own = (props.page.metaTitle || '').trim()
  if (own) return own
  const base = (props.page.title || '').trim() || t('pages.editor.metaTitlePlaceholder')
  return props.isHome || !props.siteName ? base : `${base} — ${props.siteName}`
})
const snippetDesc = computed(() => (props.page.metaDescription || '').trim() || (props.page.excerpt || '').trim() || t('pages.editor.snippetAuto'))

function onOgFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload-og-image', file)
  input.value = ''
}
</script>
