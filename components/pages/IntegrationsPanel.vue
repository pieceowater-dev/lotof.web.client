<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { pagesApi, type PagesSite, type AccessToken, type AccessScope } from '@/api/pages/ops';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { getApiBaseUrl } from '@/utils/api-base';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const props = defineProps<{ sites: PagesSite[]; nsSlug: string }>();

const { t, locale } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const tokens = ref<AccessToken[]>([]);
const loading = ref(true);

async function load() {
  try {
    tokens.value = await pagesApi.accessTokens(props.nsSlug);
  } catch (e) {
    logError('[pages/integrations] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const mcpUrl = computed(() => {
  const base = getApiBaseUrl('pages');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${base.startsWith('http') ? base : origin + base}/mcp`;
});

const SCOPES: AccessScope[] = ['read', 'write', 'publish'];
const open = ref(false);
const saving = ref(false);
const form = reactive({ name: '', scopes: ['read', 'write'] as AccessScope[], siteId: '', days: 90 });
const created = ref<{ secret: string; token: AccessToken } | null>(null);

function openCreate() {
  Object.assign(form, { name: '', scopes: ['read', 'write'], siteId: '', days: 90 });
  created.value = null;
  open.value = true;
}

// write needs read, publish needs write: picking the higher one switches on what it depends on.
function toggleScope(sc: AccessScope) {
  const has = form.scopes.includes(sc);
  let next = new Set(form.scopes);
  if (has) {
    next.delete(sc);
    if (sc === 'read') next = new Set();
    if (sc === 'write') next.delete('publish');
  } else {
    next.add(sc);
    if (sc === 'publish') next.add('write');
    if (sc === 'write' || sc === 'publish') next.add('read');
  }
  form.scopes = SCOPES.filter(x => next.has(x));
}

async function create() {
  if (!form.name.trim() || !form.scopes.length) return;
  saving.value = true;
  try {
    created.value = await pagesApi.createAccessToken(props.nsSlug, {
      name: form.name.trim(), scopes: form.scopes,
      siteId: form.siteId || undefined,
      expiresAtUnix: form.days ? Math.floor(Date.now() / 1000) + form.days * 86400 : undefined,
    });
    await load();
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function revoke(tok: AccessToken) {
  const ok = await confirm({
    title: t('pages.integrations.revokeTitle', { name: tok.name }), message: t('pages.integrations.revokeText'),
    confirmLabel: t('pages.integrations.revoke'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await pagesApi.revokeAccessToken(props.nsSlug, tok.id);
    await load();
    toast.add({ title: t('pages.integrations.revokedDone'), color: 'green' });
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  }
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.add({ title: t('pages.integrations.copied'), color: 'green' }); } catch { /* clipboard unavailable */ }
}

const fmt = (unix: number) => new Date(unix * 1000).toLocaleString(locale.value === 'kk' ? 'kk-KZ' : locale.value, { dateStyle: 'medium', timeStyle: 'short' });
const isExpired = (tok: AccessToken) => tok.expiresAtUnix > 0 && tok.expiresAtUnix * 1000 < Date.now();
const showRevoked = ref(false);
const revokedCount = computed(() => tokens.value.filter(x => x.revoked).length);
const visibleTokens = computed(() => (showRevoked.value ? tokens.value : tokens.value.filter(x => !x.revoked)));
const siteName = (tok: AccessToken) => (tok.siteId ? (props.sites.find(x => x.id === tok.siteId)?.name || tok.siteId.slice(0, 8)) : t('pages.integrations.allSites'));

const secretShown = computed(() => created.value?.secret || '<' + t('pages.integrations.createdTitle').toLowerCase() + '>');
const cliCmd = computed(() => `claude mcp add --transport http lota-pages ${mcpUrl.value} --header "Authorization: Bearer ${secretShown.value}"`);
const jsonCfg = computed(() => JSON.stringify({ mcpServers: { 'lota-pages': { type: 'http', url: mcpUrl.value, headers: { Authorization: `Bearer ${secretShown.value}` } } } }, null, 2));
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
      <p class="text-sm text-gray-700 dark:text-gray-200">{{ t('pages.integrations.lead') }}</p>
      <ol class="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-gray-700 marker:font-semibold marker:text-primary-600 dark:text-gray-300 dark:marker:text-primary-300">
        <li>{{ t('pages.integrations.step1') }}</li>
        <li>{{ t('pages.integrations.step2') }}</li>
        <li>{{ t('pages.integrations.step3') }}</li>
      </ol>
      <div class="mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('pages.integrations.urlLabel') }}</div>
      <div class="mt-1 flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800 dark:bg-white/5 dark:text-gray-100">{{ mcpUrl }}</code>
        <button type="button" class="at-btn flex-shrink-0" @click="copy(mcpUrl)"><Icon name="lucide:copy" class="h-4 w-4" />{{ t('pages.integrations.copy') }}</button>
      </div>
      <details class="group mt-3 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
          <Icon name="lucide:chevron-right" class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-90" />{{ t('pages.integrations.tools') }}
        </summary>
        <p class="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{{ t('pages.integrations.toolsText') }}</p>
      </details>
    </div>

    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.integrations.tokens') }}</h3>
      <button type="button" class="at-btn at-btn--primary" @click="openCreate"><Icon name="lucide:plus" class="h-4 w-4" />{{ t('pages.integrations.newToken') }}</button>
    </div>

    <div v-if="loading" class="py-4 text-sm text-gray-500">…</div>
    <div v-else-if="!visibleTokens.length && !revokedCount" class="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">{{ t('pages.integrations.empty') }}</div>
    <div v-else class="flex flex-col gap-2">
      <div v-for="tok in visibleTokens" :key="tok.id" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10" :class="(tok.revoked || isExpired(tok)) && 'opacity-60'">
        <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:key-round" class="h-5 w-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-gray-900 dark:text-white">{{ tok.name }}</span>
            <code class="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ tok.prefix }}…</code>
            <span v-if="tok.revoked" class="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{{ t('pages.integrations.revoked') }}</span>
            <span v-else-if="isExpired(tok)" class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{{ t('pages.integrations.expired') }}</span>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span v-for="sc in tok.scopes" :key="sc" class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="sc === 'publish' ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' : 'bg-primary-50 text-primary-700 dark:bg-blue-500/15 dark:text-primary-300'">{{ t(`pages.integrations.scope.${sc}`) }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">· {{ siteName(tok) }}</span>
            <span v-if="tok.expiresAtUnix" class="text-xs text-gray-500 dark:text-gray-400">· {{ t('pages.integrations.expires', { date: fmt(tok.expiresAtUnix) }) }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">· {{ tok.lastUsedAtUnix ? t('pages.integrations.lastUsed', { date: fmt(tok.lastUsedAtUnix) }) : t('pages.integrations.neverUsed') }}</span>
          </div>
        </div>
        <button v-if="!tok.revoked" type="button" class="at-btn hover:!bg-rose-50 hover:!text-rose-600" @click="revoke(tok)"><Icon name="lucide:ban" class="h-4 w-4" />{{ t('pages.integrations.revoke') }}</button>
      </div>
    </div>

    <button v-if="revokedCount" type="button" class="self-start text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" @click="showRevoked = !showRevoked">
      {{ showRevoked ? t('pages.integrations.hideRevoked') : t('pages.integrations.showRevoked', { n: revokedCount }) }}
    </button>

    <UModal v-model="open" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-xl' }">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="text-base font-semibold">{{ created ? t('pages.integrations.createdTitle') : t('pages.integrations.newToken') }}</h3></template>

        <div v-if="!created" class="space-y-4">
          <UFormGroup :label="t('pages.integrations.name')" required><UInput v-model="form.name" :placeholder="t('pages.integrations.namePlaceholder')" autofocus @keyup.enter="create" /></UFormGroup>

          <div>
            <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.integrations.scopes') }}</div>
            <div class="flex flex-col gap-1.5">
              <button v-for="sc in SCOPES" :key="sc" type="button" class="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left ring-1 transition"
                :class="form.scopes.includes(sc) ? 'bg-primary-50 ring-primary-300 dark:bg-blue-500/10 dark:ring-primary-500/40' : 'bg-white ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:ring-white/10 dark:hover:bg-white/5'"
                @click="toggleScope(sc)">
                <UIcon :name="form.scopes.includes(sc) ? 'lucide:circle-check' : 'lucide:circle'" class="h-5 w-5 flex-shrink-0" :class="form.scopes.includes(sc) ? 'text-primary-600' : 'text-gray-300 dark:text-gray-600'" />
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t(`pages.integrations.scope.${sc}`) }}</span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400">{{ t(`pages.integrations.scopeHint.${sc}`) }}</span>
                </span>
              </button>
            </div>
            <p v-if="form.scopes.includes('publish')" class="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">{{ t('pages.integrations.scopeSafe') }}</p>
          </div>

          <div class="grid gap-3">
            <div>
              <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.integrations.site') }}</div>
              <div class="flex flex-wrap gap-1.5">
                <button type="button" class="pill-filter" :class="!form.siteId && 'pill-filter--active'" @click="form.siteId = ''">{{ t('pages.integrations.allSites') }}</button>
                <button v-for="x in sites" :key="x.id" type="button" class="pill-filter" :class="form.siteId === x.id && 'pill-filter--active'" @click="form.siteId = x.id">{{ x.name }}</button>
              </div>
            </div>
            <div>
              <div class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('pages.integrations.expiry') }}</div>
              <div class="at-seg">
                <button v-for="d in [{ v: 30, k: 'exp30' }, { v: 90, k: 'exp90' }, { v: 365, k: 'exp365' }, { v: 0, k: 'expNever' }]" :key="d.v" type="button" class="at-seg__btn" :class="form.days === d.v && 'at-seg__btn--on'" @click="form.days = d.v">{{ t(`pages.integrations.${d.k}`) }}</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{{ t('pages.integrations.createdWarn') }}</div>
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 dark:bg-white/5 dark:text-white">{{ created.secret }}</code>
            <button type="button" class="at-btn at-btn--primary flex-shrink-0" @click="copy(created.secret)"><Icon name="lucide:copy" class="h-4 w-4" />{{ t('pages.integrations.copy') }}</button>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{{ t('pages.integrations.connectClaudeCode') }}</div>
            <div class="flex items-start gap-2">
              <pre class="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-800 dark:bg-white/5 dark:text-gray-100">{{ cliCmd }}</pre>
              <button type="button" class="at-btn !px-2.5" :aria-label="t('pages.integrations.copy')" @click="copy(cliCmd)"><Icon name="lucide:copy" class="h-4 w-4" /></button>
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{{ t('pages.integrations.connectJson') }}</div>
            <div class="flex items-start gap-2">
              <pre class="min-w-0 flex-1 overflow-x-auto rounded-xl bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-800 dark:bg-white/5 dark:text-gray-100">{{ jsonCfg }}</pre>
              <button type="button" class="at-btn !px-2.5" :aria-label="t('pages.integrations.copy')" @click="copy(jsonCfg)"><Icon name="lucide:copy" class="h-4 w-4" /></button>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.integrations.connectNote') }}</p>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <template v-if="!created">
              <button type="button" class="at-btn" @click="open = false">{{ t('common.cancel') }}</button>
              <button type="button" class="at-btn at-btn--primary" :disabled="saving || !form.name.trim() || !form.scopes.length" @click="create">
                <UIcon v-if="saving" name="lucide:loader-2" class="h-4 w-4 animate-spin" />{{ t('pages.integrations.create') }}
              </button>
            </template>
            <button v-else type="button" class="at-btn at-btn--primary" @click="open = false">{{ t('pages.integrations.done') }}</button>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
