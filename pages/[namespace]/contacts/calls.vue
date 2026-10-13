<script lang="ts" setup>
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { logError } from '@/utils/logger';
import CallRecord from '@/components/contacts/CallRecord.vue';
import {
  listCalls, listMissedCallbacks, getCallStats, updateCall, markCallbackDone, listCommentTemplates, makeCall,
  type Call, type CallList, type CallStats, type CallCommentTemplate, type CallStatus, type CallDirection,
} from '@/api/contacts/telephony';

definePageMeta({ layout: 'workspace' });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { ctx } = useCrmAuth();
const { titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
useHead(() => ({ title: `${t('contacts.callsTitle')} — Contacts — ${nsTitle.value}` }));

type Tab = 'journal' | 'missed' | 'stats';
const tab = ref<Tab>('journal');
const loading = ref(false);

// journal
const list = ref<CallList | null>(null);
const search = ref('');
const direction = ref<CallDirection | ''>('');
type StatusGroup = '' | 'ACCEPTED' | 'MISSED' | 'OTHER';
const statusGroup = ref<StatusGroup>('');
const STATUS_GROUPS: Record<Exclude<StatusGroup, ''>, CallStatus[]> = {
  ACCEPTED: ['ACCEPTED'],
  MISSED: ['MISSED'],
  OTHER: ['BUSY', 'CANCELLED', 'NOT_AVAILABLE', 'NOT_ALLOWED', 'NOT_FOUND'],
};
const favouritesOnly = ref(false);
const period = ref<'today' | '7d' | '30d' | 'all'>('7d');
const page = ref(1);
const templates = ref<CallCommentTemplate[]>([]);
const openId = ref<string | null>(null);
const draftComment = ref('');
const draftTemplate = ref('');
const draftRating = ref(0);

// missed + stats
const missed = ref<CallList | null>(null);
const stats = ref<CallStats | null>(null);

function range(): { from?: string; to?: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period.value === 'today') return { from: start.toISOString() };
  if (period.value === '7d') return { from: new Date(start.getTime() - 6 * 86400000).toISOString() };
  if (period.value === '30d') return { from: new Date(start.getTime() - 29 * 86400000).toISOString() };
  return {};
}

async function loadJournal() {
  const c = await ctx();
  if (!c) return;
  loading.value = true;
  try {
    list.value = await listCalls(c.token, c.ns, {
      search: search.value || undefined,
      direction: direction.value || undefined,
      statuses: statusGroup.value ? STATUS_GROUPS[statusGroup.value] : undefined,
      favouritesOnly: favouritesOnly.value || undefined,
      ...range(),
      pagination: { page: page.value, length: 'THIRTY' },
    });
    if (!templates.value.length) templates.value = await listCommentTemplates(c.token, c.ns);
  } catch (e) {
    logError('Failed to load calls:', e);
    toast.add({ title: t('common.error'), description: t('contacts.callsLoadError'), color: 'red' });
  } finally {
    loading.value = false;
  }
}

async function loadMissed() {
  const c = await ctx();
  if (!c) return;
  try {
    missed.value = await listMissedCallbacks(c.token, c.ns);
  } catch (e) {
    logError('Failed to load missed calls:', e);
  }
}

async function loadStats() {
  const c = await ctx();
  if (!c) return;
  try {
    stats.value = await getCallStats(c.token, c.ns, range().from);
  } catch (e) {
    logError('Failed to load call stats:', e);
  }
}

async function refresh() {
  if (tab.value === 'journal') await loadJournal();
  else if (tab.value === 'missed') await loadMissed();
  else await loadStats();
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch([direction, statusGroup, favouritesOnly, period], () => { page.value = 1; refresh(); });
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; loadJournal(); }, 300);
});
watch(page, loadJournal);
watch(tab, refresh);

onMounted(async () => {
  await Promise.all([loadJournal(), loadMissed()]);
});

function open(c: Call) {
  if (openId.value === c.id) { openId.value = null; return; }
  openId.value = c.id;
  draftComment.value = c.comment;
  draftTemplate.value = c.commentTemplateId || '';
  draftRating.value = c.operatorRating;
}

function pickTemplate(id: string) {
  draftTemplate.value = id;
  const tpl = templates.value.find(x => x.id === id);
  if (tpl) draftComment.value = tpl.text;
}

async function saveCall(c: Call) {
  const cx = await ctx();
  if (!cx) return;
  try {
    await updateCall(cx.token, cx.ns, {
      id: c.id, comment: draftComment.value, commentTemplateId: draftTemplate.value || undefined,
      operatorRating: draftRating.value, favourite: c.favourite,
    });
    openId.value = null;
    await loadJournal();
  } catch (e) {
    logError('Failed to save call:', e);
    toast.add({ title: t('common.error'), description: t('contacts.notesSaveError'), color: 'red' });
  }
}

async function toggleFavourite(c: Call) {
  const cx = await ctx();
  if (!cx) return;
  try {
    await updateCall(cx.token, cx.ns, {
      id: c.id, comment: c.comment, commentTemplateId: c.commentTemplateId || undefined,
      operatorRating: c.operatorRating, favourite: !c.favourite,
    });
    c.favourite = !c.favourite;
  } catch (e) {
    logError('Failed to toggle favourite:', e);
  }
}

async function done(c: Call) {
  const cx = await ctx();
  if (!cx) return;
  try {
    await markCallbackDone(cx.token, cx.ns, c.id);
    await loadMissed();
  } catch (e) {
    logError('Failed to mark callback:', e);
  }
}

async function callBack(c: Call) {
  const cx = await ctx();
  try {
    if (cx) {
      const res = await makeCall(cx.token, cx.ns, c.clientPhone, c.clientId || undefined);
      if (res.supported) {
        toast.add({ title: t('contacts.quickCallStarted'), color: 'emerald' });
        return;
      }
    }
  } catch (e) {
    logError('Callback failed:', e);
  }
  window.location.href = `tel:${c.clientPhone}`;
}

const totalPages = computed(() => Math.max(1, Math.ceil((list.value?.info.count || 0) / 30)));

function mmss(sec: number) {
  if (!sec) return '—';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const missedCount = computed(() => missed.value?.info.count || 0);
const goBack = () => router.push(`/${nsSlug.value}/contacts/all/1-20`);
</script>

<template>
  <div class="at-scope ct-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- header -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-start mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="at-title !text-2xl sm:!text-3xl">{{ t('contacts.callsTitle') }}</h1>
        <p class="at-sub">{{ nsTitle }}</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <NuxtLink :to="`/${nsSlug}/contacts/integrations`" class="at-btn">
          <Icon name="lucide:plug-zap" class="w-4 h-4" />{{ t('contacts.integrationsTitle') }}
        </NuxtLink>
        <button type="button" class="at-btn at-btn--blue" @click="goBack">
          <Icon name="lucide:arrow-left" class="w-4 h-4" />{{ t('app.back') }}
        </button>
      </div>
    </div>

    <!-- tabs -->
    <div class="overflow-x-auto no-scrollbar flex-shrink-0 pb-1">
      <div class="at-seg" role="tablist">
        <button type="button" role="tab" class="at-seg__btn" :class="tab === 'journal' ? 'at-seg__btn--on' : ''" @click="tab = 'journal'">
          <Icon name="lucide:phone-call" class="w-4 h-4" /><span>{{ t('contacts.callsJournal') }}</span>
        </button>
        <button type="button" role="tab" class="at-seg__btn" :class="tab === 'missed' ? 'at-seg__btn--on' : ''" @click="tab = 'missed'">
          <Icon name="lucide:phone-missed" class="w-4 h-4" /><span>{{ t('contacts.callsMissed') }}</span>
          <span v-if="missedCount" class="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-5 text-white">{{ missedCount }}</span>
        </button>
        <button type="button" role="tab" class="at-seg__btn" :class="tab === 'stats' ? 'at-seg__btn--on' : ''" @click="tab = 'stats'">
          <Icon name="lucide:bar-chart-3" class="w-4 h-4" /><span>{{ t('contacts.callsStats') }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3">
      <!-- Journal -->
      <template v-if="tab === 'journal'">
        <!-- filters: chips on a soft tray, never native selects -->
        <div class="at-panel !p-3 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <UInput v-model="search" icon="lucide:search" class="w-full sm:w-72" :placeholder="t('contacts.callsSearch')" />
            <div class="flex gap-1.5 flex-wrap">
              <button v-for="p in (['today', '7d', '30d', 'all'] as const)" :key="p" type="button" class="pill-filter" :class="period === p ? 'pill-filter--active' : ''" @click="period = p">
                {{ t(p === 'today' ? 'contacts.periodToday' : p === '7d' ? 'contacts.period7d' : p === '30d' ? 'contacts.period30d' : 'contacts.periodAll') }}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" class="pill-filter" :class="direction === '' ? 'pill-filter--active' : ''" @click="direction = ''">{{ t('contacts.callsAll') }}</button>
            <button type="button" class="pill-filter" :class="direction === 'IN' ? 'pill-filter--active' : ''" @click="direction = 'IN'"><Icon name="lucide:phone-incoming" class="w-3.5 h-3.5" />{{ t('contacts.callIn') }}</button>
            <button type="button" class="pill-filter" :class="direction === 'OUT' ? 'pill-filter--active' : ''" @click="direction = 'OUT'"><Icon name="lucide:phone-outgoing" class="w-3.5 h-3.5" />{{ t('contacts.callOut') }}</button>
            <span class="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
            <button type="button" class="pill-filter" :class="statusGroup === '' ? 'pill-filter--active' : ''" @click="statusGroup = ''">{{ t('contacts.callsAnyStatus') }}</button>
            <button type="button" class="pill-filter" :class="statusGroup === 'ACCEPTED' ? 'pill-filter--active' : ''" @click="statusGroup = 'ACCEPTED'">{{ t('contacts.callStatus_ACCEPTED') }}</button>
            <button type="button" class="pill-filter" :class="statusGroup === 'MISSED' ? 'pill-filter--active' : ''" @click="statusGroup = 'MISSED'">{{ t('contacts.callStatus_MISSED') }}</button>
            <button type="button" class="pill-filter" :class="statusGroup === 'OTHER' ? 'pill-filter--active' : ''" @click="statusGroup = 'OTHER'">{{ t('contacts.callsOtherStatuses') }}</button>
            <span class="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
            <button type="button" class="pill-filter" :class="favouritesOnly ? 'pill-filter--rose' : ''" @click="favouritesOnly = !favouritesOnly">
              <Icon name="lucide:star" class="w-3.5 h-3.5" />{{ t('contacts.callFavourites') }}
            </button>
          </div>
          <div v-if="list && list.info.count" class="flex items-center gap-1.5 flex-wrap text-xs">
            <span class="at-chip">{{ list.info.count }} {{ t('contacts.callsCountSuffix') }}</span>
            <span class="at-chip">{{ t('contacts.callMin') }} {{ mmss(list.minDurationSec) }}</span>
            <span class="at-chip">{{ t('contacts.callAvg') }} {{ mmss(list.avgDurationSec) }}</span>
            <span class="at-chip">{{ t('contacts.callMax') }} {{ mmss(list.maxDurationSec) }}</span>
          </div>
        </div>

        <AppSkeleton v-if="loading && !list" variant="table" :rows="6" :cols="4" />
        <div v-else-if="list && !list.rows.length" class="at-empty-box">
          <div class="at-empty-ico"><Icon name="lucide:phone-off" class="w-5 h-5" /></div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('contacts.callsEmpty') }}</p>
        </div>

        <div v-for="c in list?.rows" :key="c.id" class="at-row !p-3.5">
          <div class="flex items-start gap-3 flex-wrap">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-baseline gap-2 flex-wrap">
                <NuxtLink v-if="c.clientId" :to="`/${nsSlug}/contacts/${c.clientId}`" class="font-semibold hover:underline">{{ c.clientName || c.clientPhone }}</NuxtLink>
                <span v-else class="font-semibold">{{ c.clientPhone }}</span>
                <span v-if="c.clientId" class="text-xs text-slate-500">{{ c.clientPhone }}</span>
                <span v-if="c.extension" class="text-xs text-slate-400">· {{ c.extension }}</span>
              </div>
              <CallRecord :call="c" />
              <p v-if="c.comment" class="text-xs text-slate-600 dark:text-slate-300">{{ c.comment }}</p>
              <p v-if="c.orderIds.length" class="text-xs text-slate-500">{{ t('contacts.callLinkedOrders') }}: {{ c.orderIds.join(', ') }}</p>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="cp-icon" :class="c.favourite ? '!bg-rose-500/10 !text-rose-500' : ''" :aria-label="t('contacts.callFavourites')" @click="toggleFavourite(c)">
                <Icon name="lucide:star" class="w-4 h-4" :class="c.favourite ? 'fill-current' : ''" />
              </button>
              <button type="button" class="cp-icon" :aria-label="t('contacts.callComment')" @click="open(c)">
                <Icon name="lucide:message-square-text" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div v-if="openId === c.id" class="mt-3 space-y-3 border-t border-slate-900/5 pt-3 dark:border-white/10">
            <div v-if="templates.length" class="flex gap-1.5 flex-wrap">
              <button v-for="tpl in templates" :key="tpl.id" type="button" class="pill-filter" :class="draftTemplate === tpl.id ? 'pill-filter--active' : ''" @click="pickTemplate(tpl.id)">{{ tpl.text }}</button>
            </div>
            <div class="flex items-center gap-1 text-sm">
              <span class="mr-1 text-slate-500">{{ t('contacts.callRating') }}</span>
              <button v-for="n in 5" :key="n" type="button" :aria-label="String(n)" @click="draftRating = draftRating === n ? 0 : n">
                <Icon name="lucide:star" class="w-5 h-5" :class="n <= draftRating ? 'text-amber-500 fill-current' : 'text-slate-300 dark:text-slate-600'" />
              </button>
            </div>
            <UTextarea v-model="draftComment" :rows="2" autoresize :placeholder="t('contacts.callComment')" />
            <div class="flex justify-end gap-2">
              <button type="button" class="at-btn" @click="openId = null">{{ t('common.cancel') }}</button>
              <button type="button" class="at-btn at-btn--primary" @click="saveCall(c)">{{ t('contacts.notesSave') }}</button>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 py-2">
          <button type="button" class="cp-icon" :disabled="page <= 1" @click="page--"><Icon name="lucide:chevron-left" class="w-4 h-4" /></button>
          <span class="text-sm tabular-nums">{{ page }} / {{ totalPages }}</span>
          <button type="button" class="cp-icon" :disabled="page >= totalPages" @click="page++"><Icon name="lucide:chevron-right" class="w-4 h-4" /></button>
        </div>
      </template>

      <!-- Missed callbacks -->
      <template v-else-if="tab === 'missed'">
        <div class="at-banner"><span class="text-sm">{{ t('contacts.callsMissedHint') }}</span></div>
        <div v-if="missed && !missed.rows.length" class="at-empty-box">
          <div class="at-empty-ico"><Icon name="lucide:check-check" class="w-5 h-5" /></div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('contacts.callsMissedEmpty') }}</p>
        </div>
        <div v-for="c in missed?.rows" :key="c.id" class="at-row !p-3.5 flex items-center gap-3 flex-wrap">
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex items-baseline gap-2 flex-wrap">
              <NuxtLink v-if="c.clientId" :to="`/${nsSlug}/contacts/${c.clientId}`" class="font-semibold hover:underline">{{ c.clientName || c.clientPhone }}</NuxtLink>
              <span v-else class="font-semibold">{{ c.clientPhone }}</span>
              <span v-if="c.clientId" class="text-xs text-slate-500">{{ c.clientPhone }}</span>
            </div>
            <CallRecord :call="c" />
          </div>
          <button type="button" class="at-btn at-btn--primary" @click="callBack(c)"><Icon name="lucide:phone" class="w-4 h-4" />{{ t('contacts.callsCallBack') }}</button>
          <button type="button" class="at-btn" @click="done(c)"><Icon name="lucide:check" class="w-4 h-4" />{{ t('contacts.callbackMark') }}</button>
        </div>
      </template>

      <!-- Stats -->
      <template v-else>
        <div class="flex gap-1.5 flex-wrap">
          <button v-for="p in (['today', '7d', '30d', 'all'] as const)" :key="p" type="button" class="pill-filter" :class="period === p ? 'pill-filter--active' : ''" @click="period = p">
            {{ t(p === 'today' ? 'contacts.periodToday' : p === '7d' ? 'contacts.period7d' : p === '30d' ? 'contacts.period30d' : 'contacts.periodAll') }}
          </button>
        </div>
        <AppSkeleton v-if="!stats" variant="panel" :rows="2" />
        <template v-else>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="card in [
              { k: 'statsTotal', v: stats.total }, { k: 'statsIncoming', v: stats.incoming },
              { k: 'statsOutgoing', v: stats.outgoing }, { k: 'statsMissed', v: stats.missed },
              { k: 'statsUnreturned', v: stats.missedUnreturned }, { k: 'statsCallbacks', v: stats.callbacksDone },
              { k: 'statsAvgDuration', v: mmss(stats.avgDurationSec) }, { k: 'statsMaxDuration', v: mmss(stats.maxDurationSec) },
            ]" :key="card.k" class="at-stat !py-4">
              <div class="text-2xl font-extrabold tabular-nums grad-text">{{ card.v }}</div>
              <div class="mt-1 text-xs text-slate-500">{{ t(`contacts.${card.k}`) }}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="at-panel">
              <h3 class="at-h2 mb-2">{{ t('contacts.statsByDay') }}</h3>
              <div v-for="d in stats.byDay" :key="d.day" class="flex justify-between py-1 text-sm">
                <span>{{ d.day }}</span><span class="tabular-nums">{{ d.total }} <span v-if="d.missed" class="text-rose-600">({{ d.missed }})</span></span>
              </div>
              <p v-if="!stats.byDay.length" class="text-sm text-slate-400">—</p>
            </div>
            <div class="at-panel">
              <h3 class="at-h2 mb-2">{{ t('contacts.statsByOperator') }}</h3>
              <div v-for="o in stats.byOperator" :key="o.operatorUserId" class="flex justify-between py-1 text-sm">
                <span class="truncate">{{ o.operatorUserId.slice(0, 8) }}</span>
                <span class="tabular-nums">{{ o.acceptedIn }} / {{ o.outgoing }} · {{ mmss(o.talkSeconds) }}</span>
              </div>
              <p v-if="!stats.byOperator.length" class="text-sm text-slate-400">—</p>
            </div>
            <div class="at-panel">
              <h3 class="at-h2 mb-2">{{ t('contacts.statsByLine') }}</h3>
              <div v-for="l in stats.byLine" :key="l.lineNumber + l.source" class="flex justify-between py-1 text-sm">
                <span class="truncate">{{ l.lineNumber }}<span v-if="l.source" class="text-slate-400"> · {{ l.source }}</span></span><span class="tabular-nums">{{ l.total }}</span>
              </div>
              <p v-if="!stats.byLine.length" class="text-sm text-slate-400">—</p>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
