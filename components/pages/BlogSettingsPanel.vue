<script lang="ts" setup>
// Blog and search switches of a site (Settings.featuresJson). Everything is on by default except search.
import { useI18n } from '@/composables/useI18n'
import type { PagesSite } from '@/api/pages/ops'

const props = defineProps<{ site: PagesSite; saving?: boolean }>()
const emit = defineEmits<{ save: [featuresJson: string] }>()
const { t } = useI18n()

const LAYOUTS = ['', 'wide', 'narrow', 'sidebar']
const KINDS = ['page', 'post', 'news']
const form = reactive({
  blogPath: 'blog', perPage: 10, search: false, rss: true, archives: true, authors: true, related: true,
  layouts: { page: '', post: '', news: '' } as Record<string, string>,
})
const saved = ref('')

function load() {
  let o: any = {}
  try { o = JSON.parse(props.site.settings.featuresJson || '{}') || {} } catch { o = {} }
  form.blogPath = String(o.blogPath || '/blog').replace(/^\/+|\/+$/g, '') || 'blog'
  form.perPage = [6, 10, 20].includes(Number(o.perPage)) ? Number(o.perPage) : 10
  form.search = !!o.search
  for (const k of ['rss', 'archives', 'authors', 'related'] as const) form[k] = o[k] !== false
  for (const k of KINDS) form.layouts[k] = LAYOUTS.includes(o.layouts?.[k]) ? o.layouts[k] : ''
  saved.value = snapshot()
}
const snapshot = () => JSON.stringify(form)
watch(() => props.site, load, { immediate: true })
const dirty = computed(() => snapshot() !== saved.value)

function save() {
  const layouts: Record<string, string> = {}
  for (const k of KINDS) if (form.layouts[k]) layouts[k] = form.layouts[k]
  const path = '/' + (form.blogPath.trim().toLowerCase().replace(/[^a-z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'blog')
  const out: Record<string, any> = { blogPath: path, perPage: form.perPage, search: form.search, rss: form.rss, archives: form.archives, authors: form.authors, related: form.related }
  if (Object.keys(layouts).length) out.layouts = layouts
  emit('save', JSON.stringify(out))
  saved.value = snapshot()
}

const toggles = ['search', 'rss', 'archives', 'authors', 'related'] as const
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.blog.title') }}</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.blog.hint') }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormGroup :label="t('pages.blog.path')" :help="t('pages.blog.pathHint')">
        <UInput v-model="form.blogPath" maxlength="40" :ui="{ leading: { padding: { md: 'ps-8' } } }">
          <template #leading><span class="text-sm text-gray-400">/</span></template>
        </UInput>
      </UFormGroup>
      <UFormGroup :label="t('pages.blog.perPage')">
        <div class="at-seg !min-w-0 self-start">
          <button v-for="n in [6, 10, 20]" :key="n" type="button" class="at-seg__btn" :class="form.perPage === n && 'at-seg__btn--on'" @click="form.perPage = n">{{ n }}</button>
        </div>
      </UFormGroup>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <label v-for="k in toggles" :key="k" class="flex cursor-pointer items-start gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
        <UToggle v-model="form[k]" class="mt-0.5 flex-shrink-0" />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ t(`pages.blog.f.${k}`) }}</span>
          <span class="block text-xs text-gray-500 dark:text-gray-400">{{ t(`pages.blog.f.${k}Hint`) }}</span>
        </span>
      </label>
    </div>

    <div>
      <div class="text-sm font-medium text-gray-900 dark:text-white">{{ t('pages.blog.layouts') }}</div>
      <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.blog.layoutsHint') }}</p>
      <div class="grid gap-2 sm:grid-cols-3">
        <div v-for="k in KINDS" :key="k" class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-gray-600 dark:text-gray-300">{{ t(`pages.blog.kind.${k}`) }}</span>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="l in LAYOUTS" :key="l" type="button" class="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition" :class="form.layouts[k] === l ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-600 ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:ring-white/10'" @click="form.layouts[k] = l">{{ t(`pages.blog.layout.${l || 'default'}`) }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-end gap-3">
      <span v-if="dirty" class="text-xs text-amber-600 dark:text-amber-300">{{ t('pages.blog.unsaved') }}</span>
      <button type="button" class="at-btn at-btn--primary" :disabled="saving || !dirty" @click="save"><Icon name="lucide:save" class="h-4 w-4" />{{ t('common.save') }}</button>
    </div>
  </section>
</template>
