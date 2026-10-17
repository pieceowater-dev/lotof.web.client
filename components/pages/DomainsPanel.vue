<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { pagesApi, type PagesSite, type SiteDomain, type SiteDomains, type DnsRecord } from '@/api/pages/ops';
import { siteOrigin } from '@/utils/pagesSite';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';

const props = defineProps<{ site: PagesSite; nsSlug: string }>();
const emit = defineEmits<{ changed: [] }>();

const { t, locale } = useI18n();
const toast = useToast();
const { confirm } = useConfirm();

const data = ref<SiteDomains | null>(null);
const loading = ref(true);
const hostname = ref('');
const adding = ref(false);
const addError = ref('');
const howOpen = ref(false);
const busy = reactive<Record<string, boolean>>({});

async function load() {
  try {
    data.value = await pagesApi.domains(props.nsSlug, props.site.id);
  } catch (e) {
    logError('[pages/domains] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(() => { load(); startPolling(); });

// Domains that are not active yet are re-checked in the background, so the status moves on its own.
let timer: ReturnType<typeof setInterval> | null = null;
function startPolling() {
  timer = setInterval(async () => {
    const waiting = (data.value?.domains || []).filter(d => d.status !== 'DOMAIN_ACTIVE' && d.status !== 'DOMAIN_SUSPENDED');
    if (!waiting.length || document.hidden) return;
    for (const d of waiting) await check(d, true);
  }, 15000);
}
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

const platformIsPrimary = computed(() => data.value?.primaryHost === data.value?.platformHost);
const dnsErr = (code: string) => (code ? `pages.domains.err.${code.split(':')[0]}` : '');

async function add() {
  addError.value = '';
  const value = hostname.value.trim();
  if (!value) return;
  adding.value = true;
  try {
    const d = await pagesApi.addDomain(props.nsSlug, props.site.id, value);
    hostname.value = '';
    await load();
    expanded[d.id] = true;
    toast.add({ title: t('pages.domains.added'), color: 'green' });
  } catch (e: any) {
    const msg = String(e?.response?.errors?.[0]?.message || '');
    if (msg.includes('already connected')) addError.value = t('pages.domains.errTaken');
    else if (msg.includes('belongs to the platform')) addError.value = t('pages.domains.errReserved');
    else if (msg.includes('invalid domain')) addError.value = t('pages.domains.errInvalid');
    else if (msg.includes('limit')) addError.value = t('pages.domains.errLimit');
    else addError.value = getErrorMessage(e, t) || t('common.errorRetry');
  } finally {
    adding.value = false;
  }
}

async function check(d: SiteDomain, silent = false) {
  busy[d.id] = true;
  try {
    const before = d.status;
    const updated = await pagesApi.checkDomain(props.nsSlug, d.id);
    await load();
    if (before !== 'DOMAIN_ACTIVE' && updated.status === 'DOMAIN_ACTIVE') {
      toast.add({ title: t('pages.domains.nowActive', { host: updated.displayHostname }), color: 'green' });
      emit('changed');
    } else if (!silent) {
      toast.add({ title: t('pages.domains.checked'), description: updated.lastError ? t(dnsErr(updated.lastError)) : undefined, color: updated.status === 'DOMAIN_ACTIVE' ? 'green' : 'amber' });
    }
  } catch (e) {
    if (!silent) toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    busy[d.id] = false;
  }
}

async function makePrimary(hostnameToUse: string, label: string) {
  const ok = await confirm({
    title: t('pages.domains.primaryTitle', { host: label }), message: t('pages.domains.primaryText'),
    confirmLabel: t('pages.domains.makePrimary'), cancelLabel: t('common.cancel'), color: 'primary', icon: 'lucide:star',
  });
  if (!ok) return;
  busy[hostnameToUse] = true;
  try {
    await pagesApi.setPrimaryDomain(props.nsSlug, props.site.id, hostnameToUse);
    await load();
    emit('changed');
    toast.add({ title: t('pages.domains.primaryDone', { host: label }), color: 'green' });
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    busy[hostnameToUse] = false;
  }
}

async function remove(d: SiteDomain) {
  const ok = await confirm({
    title: t('pages.domains.removeTitle', { host: d.displayHostname }), message: d.isPrimary ? t('pages.domains.removePrimaryText') : t('pages.domains.removeText'),
    confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  busy[d.id] = true;
  try {
    await pagesApi.removeDomain(props.nsSlug, d.id);
    await load();
    emit('changed');
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t) || t('common.errorRetry'), color: 'red' });
  } finally {
    busy[d.id] = false;
  }
}

const expanded = reactive<Record<string, boolean>>({});
const isOpen = (d: SiteDomain) => expanded[d.id] ?? (d.status !== 'DOMAIN_ACTIVE');

const STATUS: Record<string, { key: string; cls: string; icon: string }> = {
  DOMAIN_PENDING_DNS: { key: 'pending', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: 'lucide:clock' },
  DOMAIN_DNS_VERIFIED: { key: 'tls', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', icon: 'lucide:shield-check' },
  DOMAIN_TLS_PROVISIONING: { key: 'tls', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', icon: 'lucide:shield-check' },
  DOMAIN_ACTIVE: { key: 'active', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: 'lucide:circle-check' },
  DOMAIN_TLS_FAILED: { key: 'tlsFailed', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: 'lucide:circle-alert' },
  DOMAIN_MISCONFIGURED: { key: 'misconfigured', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', icon: 'lucide:triangle-alert' },
  DOMAIN_SUSPENDED: { key: 'suspended', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: 'lucide:pause-circle' },
};
const status = (d: SiteDomain) => STATUS[d.status] || STATUS.DOMAIN_PENDING_DNS;

const fmt = (unix: number) => new Date(unix * 1000).toLocaleString(locale.value === 'kk' ? 'kk-KZ' : locale.value, { dateStyle: 'medium', timeStyle: 'short' });

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.add({ title: t('pages.domains.copied'), color: 'green' }); } catch { /* clipboard unavailable */ }
}
const recordTitle = (r: DnsRecord) => t(`pages.domains.purpose.${r.purpose}`);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="loading" class="py-4 text-sm text-gray-500">…</div>
    <template v-else-if="data">
      <!-- platform address -->
      <div class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:globe" class="h-5 w-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <a :href="siteOrigin(data.platformHost)" target="_blank" rel="noopener noreferrer" class="break-all font-semibold text-gray-900 hover:underline dark:text-white">{{ data.platformHost }}</a>
            <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="platformIsPrimary ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'">
              {{ platformIsPrimary ? t('pages.domains.primary') : t('pages.domains.redirecting') }}
            </span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.domains.platformHint') }}</div>
        </div>
        <button v-if="!platformIsPrimary" type="button" class="at-btn" :disabled="busy[data.platformHost]" @click="makePrimary(data.platformHost, data.platformHost)">
          <Icon name="lucide:star" class="h-4 w-4" />{{ t('pages.domains.makePrimary') }}
        </button>
      </div>

      <!-- add -->
      <div class="rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:p-5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('pages.domains.addTitle') }}</h3>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('pages.domains.addHint') }}</p>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <UInput v-model="hostname" class="flex-1" :placeholder="t('pages.domains.placeholder')" @keyup.enter="add" />
          <button type="button" class="at-btn at-btn--primary justify-center" :disabled="adding || !hostname.trim()" @click="add">
            <UIcon :name="adding ? 'lucide:loader-2' : 'lucide:plus'" class="h-4 w-4" :class="adding && 'animate-spin'" />{{ t('pages.domains.connect') }}
          </button>
        </div>
        <p v-if="addError" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ addError }}</p>

        <button type="button" class="mt-4 flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-left text-sm font-medium text-gray-800 ring-1 ring-black/5 transition hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:ring-white/10 dark:hover:bg-white/10" :aria-expanded="howOpen" @click="howOpen = !howOpen">
          <Icon name="lucide:book-open" class="h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-300" />
          <span class="flex-1">{{ t('pages.domains.how.title') }}</span>
          <Icon name="lucide:chevron-down" class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform" :class="howOpen && 'rotate-180'" />
        </button>
        <ol v-if="howOpen" class="mt-3 flex list-decimal flex-col gap-2.5 pl-5 text-sm text-gray-700 marker:font-semibold marker:text-primary-600 dark:text-gray-300 dark:marker:text-primary-300">
          <li>{{ t('pages.domains.how.s1') }}</li>
          <li>{{ t('pages.domains.how.s2') }}</li>
          <li>{{ t('pages.domains.how.s3') }}</li>
          <li>{{ t('pages.domains.how.s4', { ip: data.ips[0] || '…', cname: data.cnameTarget || 'sites.lota.tools' }) }}</li>
          <li>{{ t('pages.domains.how.s5') }}</li>
          <li>{{ t('pages.domains.how.s6') }}</li>
        </ol>
        <p v-if="howOpen" class="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">{{ t('pages.domains.how.tip', { cname: data.cnameTarget || 'sites.lota.tools' }) }}</p>
      </div>

      <!-- domains -->
      <div v-if="!data.domains.length" class="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400">
        {{ t('pages.domains.empty') }}
      </div>

      <div v-for="d in data.domains" :key="d.id" class="rounded-2xl bg-white ring-1 ring-black/5 dark:bg-[#1f1f1f] dark:ring-white/10">
        <div class="flex flex-wrap items-center gap-3 p-4">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="expanded[d.id] = !isOpen(d)">
            <span class="icon-tile !h-10 !w-10 flex-shrink-0"><UIcon name="lucide:link-2" class="h-5 w-5" /></span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="break-all font-semibold text-gray-900 dark:text-white">{{ d.displayHostname }}</span>
                <span v-if="d.isPrimary" class="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">{{ t('pages.domains.primary') }}</span>
              </div>
              <div class="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" :class="status(d).cls">
                <UIcon :name="status(d).icon" class="h-3.5 w-3.5" />{{ t(`pages.domains.status.${status(d).key}`) }}
              </div>
            </div>
          </button>
          <div class="flex flex-shrink-0 flex-wrap items-center gap-1.5">
            <a v-if="d.status === 'DOMAIN_ACTIVE'" :href="siteOrigin(d.hostname)" target="_blank" rel="noopener noreferrer" class="at-btn !px-2.5" :title="t('pages.openSite')" :aria-label="t('pages.openSite')"><Icon name="lucide:external-link" class="h-4 w-4" /></a>
            <button v-if="d.status === 'DOMAIN_ACTIVE' && !d.isPrimary" type="button" class="at-btn" :disabled="busy[d.hostname]" @click="makePrimary(d.hostname, d.displayHostname)">
              <Icon name="lucide:star" class="h-4 w-4" /><span class="hidden sm:inline">{{ t('pages.domains.makePrimary') }}</span>
            </button>
            <button v-if="d.status !== 'DOMAIN_ACTIVE'" type="button" class="at-btn at-btn--blue" :disabled="busy[d.id]" @click="check(d)">
              <UIcon :name="busy[d.id] ? 'lucide:loader-2' : 'lucide:refresh-cw'" class="h-4 w-4" :class="busy[d.id] && 'animate-spin'" />{{ t('pages.domains.checkNow') }}
            </button>
            <button type="button" class="at-btn !px-2.5 hover:!bg-rose-50 hover:!text-rose-600" :disabled="busy[d.id]" :aria-label="t('common.delete')" :title="t('common.delete')" @click="remove(d)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
          </div>
        </div>

        <div v-if="isOpen(d)" class="flex flex-col gap-3 border-t border-black/5 p-4 dark:border-white/10">
          <div v-if="d.status === 'DOMAIN_MISCONFIGURED'" class="rounded-xl bg-orange-50 px-3.5 py-2.5 text-sm text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
            {{ t('pages.domains.misconfiguredText', { date: d.suspendAtUnix ? fmt(d.suspendAtUnix) : '' }) }}
          </div>
          <div v-else-if="d.status === 'DOMAIN_SUSPENDED'" class="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{{ t('pages.domains.suspendedText') }}</div>
          <div v-else-if="d.status === 'DOMAIN_TLS_PROVISIONING' || d.status === 'DOMAIN_DNS_VERIFIED'" class="rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">{{ t('pages.domains.tlsText') }}</div>
          <div v-else-if="d.status === 'DOMAIN_TLS_FAILED'" class="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{{ t('pages.domains.tlsFailedText') }}</div>

          <template v-if="d.status !== 'DOMAIN_ACTIVE'">
            <p class="text-sm text-gray-700 dark:text-gray-200">{{ t('pages.domains.instructions') }}</p>
            <div class="overflow-x-auto rounded-xl ring-1 ring-black/5 dark:ring-white/10">
              <table class="w-full min-w-[34rem] text-sm">
                <thead class="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/5">
                  <tr><th class="px-3 py-2">{{ t('pages.domains.colType') }}</th><th class="px-3 py-2">{{ t('pages.domains.colName') }}</th><th class="px-3 py-2">{{ t('pages.domains.colValue') }}</th><th class="px-3 py-2 text-right" /></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in d.records" :key="i" class="border-t border-black/5 dark:border-white/10">
                    <td class="whitespace-nowrap px-3 py-2.5 align-top">
                      <span class="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold dark:bg-white/10">{{ r.type }}</span>
                      <div class="mt-1 text-[11px] text-gray-400">{{ recordTitle(r) }}</div>
                    </td>
                    <td class="px-3 py-2.5 align-top"><button type="button" class="break-all text-left font-mono text-xs hover:underline" @click="copy(r.name)">{{ r.name }}</button></td>
                    <td class="px-3 py-2.5 align-top"><button type="button" class="break-all text-left font-mono text-xs hover:underline" @click="copy(r.value)">{{ r.value }}</button></td>
                    <td class="whitespace-nowrap px-3 py-2.5 text-right align-top">
                      <UIcon v-if="r.done" name="lucide:circle-check" class="h-4 w-4 text-emerald-500" :title="t('pages.domains.recordFound')" />
                      <UIcon v-else name="lucide:circle-dashed" class="h-4 w-4 text-gray-300 dark:text-gray-600" :title="t('pages.domains.recordMissing')" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="d.isApex" class="text-xs text-gray-500 dark:text-gray-400">{{ t('pages.domains.apexHint') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('pages.domains.propagation') }}</p>
          </template>

          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span v-if="d.lastError">{{ t(dnsErr(d.lastError)) }}</span><span v-else />
            <span v-if="d.lastCheckedAtUnix">{{ t('pages.domains.lastChecked', { date: fmt(d.lastCheckedAtUnix) }) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
