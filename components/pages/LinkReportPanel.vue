<script lang="ts" setup>
// Two helpers for search visibility: internal-link hints (pages nobody links to, pages buried too deep, places where
// a link to a related page is missing) and the log of addresses visitors asked for that do not exist.
import { useI18n } from '@/composables/useI18n'
import { pagesApi, type LinkReport, type NotFoundEntry } from '@/api/pages/ops'
import { getErrorMessage } from '@/utils/types/errors'

const props = defineProps<{ siteId: string; nsSlug: string; pagesCount: number }>()
const { t } = useI18n()
const toast = useToast()

const report = ref<LinkReport | null>(null)
const log = ref<NotFoundEntry[]>([])
const loading = ref(true)
const target = reactive<Record<string, string>>({})
const busy = ref('')

async function load() {
  loading.value = true
  try {
    const [r, l] = await Promise.all([pagesApi.linkReport(props.nsSlug, props.siteId), pagesApi.notFoundLog(props.nsSlug, props.siteId)])
    report.value = r
    log.value = l
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' })
  } finally { loading.value = false }
}
onMounted(load)
watch(() => props.pagesCount, load)

const clean = computed(() => !!report.value && !report.value.orphans.length && !report.value.deep.length && !report.value.suggestions.length)
const lastSeen = (e: NotFoundEntry) => (e.lastSeenUnix ? new Date(e.lastSeenUnix * 1000).toLocaleDateString() : '')

async function redirect(e: NotFoundEntry) {
  const to = (target[e.path] || '').trim()
  if (!to) return
  busy.value = e.path
  try {
    await pagesApi.upsertRedirect(props.nsSlug, { siteId: props.siteId, fromPath: e.path, toPath: to.startsWith('http') ? to : '/' + to.replace(/^\/+/, ''), code: 301 })
    await pagesApi.clearNotFound(props.nsSlug, props.siteId, e.path)
    toast.add({ title: t('pages.seoTools.redirected'), description: t('pages.settings.needsPublish'), color: 'green' })
    log.value = log.value.filter(x => x.path !== e.path)
  } catch (err) {
    toast.add({ title: t('common.error'), description: getErrorMessage(err, t) || t('common.errorRetry'), color: 'red' })
  } finally { busy.value = '' }
}
async function dismiss(e: NotFoundEntry) {
  busy.value = e.path
  try { await pagesApi.clearNotFound(props.nsSlug, props.siteId, e.path); log.value = log.value.filter(x => x.path !== e.path) } finally { busy.value = '' }
}
async function clearAll() {
  try { await pagesApi.clearNotFound(props.nsSlug, props.siteId); log.value = [] } catch { /* the list just stays */ }
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.seoTools.linksTitle') }}</h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.seoTools.linksHint') }}</p>
      <p v-if="loading" class="mt-3 text-sm text-gray-500">…</p>
      <template v-else-if="report">
        <p v-if="clean" class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">{{ t('pages.seoTools.linksClean', { n: report.pages }) }}</p>
        <div v-if="report.orphans.length" class="mt-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('pages.seoTools.orphans') }}</div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.seoTools.orphansHint') }}</p>
          <ul class="mt-1.5 flex flex-col gap-1">
            <li v-for="o in report.orphans" :key="o.pageId" class="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-sm dark:bg-white/5">
              <span class="min-w-0 truncate">{{ o.title }} <span class="text-xs text-gray-400">{{ o.path }}</span></span>
              <NuxtLink :to="`/${nsSlug}/pages/${siteId}/edit/${o.pageId}`" class="flex-shrink-0 text-xs font-semibold text-primary-600 dark:text-primary-300">{{ t('pages.pages.edit') }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div v-if="report.deep.length" class="mt-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('pages.seoTools.deep') }}</div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.seoTools.deepHint') }}</p>
          <ul class="mt-1.5 flex flex-col gap-1">
            <li v-for="d in report.deep" :key="d.pageId" class="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-sm dark:bg-white/5">
              <span class="min-w-0 truncate">{{ d.title }} <span class="text-xs text-gray-400">{{ d.path }}</span></span>
              <span class="flex-shrink-0 text-xs text-gray-500">{{ d.depth < 0 ? t('pages.seoTools.unreachable') : t('pages.seoTools.clicks', { n: d.depth }) }}</span>
            </li>
          </ul>
        </div>
        <div v-if="report.suggestions.length" class="mt-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('pages.seoTools.suggestions') }}</div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.seoTools.suggestionsHint') }}</p>
          <ul class="mt-1.5 flex flex-col gap-1">
            <li v-for="(s, i) in report.suggestions.slice(0, 30)" :key="i" class="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-sm dark:bg-white/5">
              <span class="min-w-0">{{ t('pages.seoTools.suggestionText', { page: s.pageTitle, phrase: s.phrase, target: s.targetPath }) }}</span>
              <NuxtLink :to="`/${nsSlug}/pages/${siteId}/edit/${s.pageId}`" class="flex-shrink-0 text-xs font-semibold text-primary-600 dark:text-primary-300">{{ t('pages.pages.edit') }}</NuxtLink>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.seoTools.notFoundTitle') }}</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.seoTools.notFoundHint') }}</p>
        </div>
        <button v-if="log.length" type="button" class="at-btn" @click="clearAll">{{ t('pages.seoTools.clearAll') }}</button>
      </div>
      <p v-if="!loading && !log.length" class="mt-3 rounded-xl bg-gray-50 px-3 py-3 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.seoTools.notFoundNone') }}</p>
      <ul v-else class="mt-3 flex flex-col gap-2">
        <li v-for="e in log" :key="e.path" class="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="min-w-0 truncate font-mono text-sm text-gray-900 dark:text-white">{{ e.path }}</span>
            <span class="flex-shrink-0 text-xs text-gray-500">{{ t('pages.seoTools.hits', { n: e.hits }) }}<template v-if="lastSeen(e)"> · {{ lastSeen(e) }}</template></span>
          </div>
          <div v-if="e.referrer" class="truncate text-xs text-gray-400">{{ t('pages.seoTools.from') }} {{ e.referrer }}</div>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <template v-if="e.hasRedirect"><span class="text-xs text-emerald-600 dark:text-emerald-300">{{ t('pages.seoTools.covered') }}</span></template>
            <template v-else>
              <UInput v-model="target[e.path]" size="sm" class="min-w-[10rem] flex-1" :placeholder="t('pages.seoTools.redirectTo')" @keyup.enter="redirect(e)" />
              <button type="button" class="at-btn at-btn--blue" :disabled="busy === e.path || !(target[e.path] || '').trim()" @click="redirect(e)">{{ t('pages.seoTools.redirect') }}</button>
            </template>
            <button type="button" class="at-btn" :disabled="busy === e.path" @click="dismiss(e)">{{ t('pages.seoTools.dismiss') }}</button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
