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
const status = ref<CallStatus | ''>('');
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
      statuses: status.value ? [status.value] : undefined,
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
watch([direction, status, favouritesOnly, period], () => { page.value = 1; refresh(); });
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

const statusOptions: CallStatus[] = ['ACCEPTED', 'MISSED', 'BUSY', 'CANCELLED', 'NOT_AVAILABLE', 'NOT_ALLOWED', 'NOT_FOUND'];
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
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 flex-shrink-0 gap-3">
      <div class="text-left">
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">{{ t('contacts.callsTitle') }}</h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ nsTitle }}</span>
      </div>
      <UButton icon="lucide:arrow-left" size="xs" color="primary" variant="soft" class="self-start" @click="goBack">
        {{ t('app.back') }}
      </UButton>
    </div>

    <div class="flex items-center gap-2 mb-3 flex-shrink-0 overflow-x-auto">
      <button class="pill-filter" :class="tab === 'journal' ? 'pill-filter--active' : ''" @click="tab = 'journal'">{{ t('contacts.callsJournal') }}</button>
      <button class="pill-filter" :class="tab === 'missed' ? 'pill-filter--active' : ''" @click="tab = 'missed'">
        {{ t('contacts.callsMissed') }}<span v-if="missedCount" class="ml-1.5 text-xs px-1.5 rounded-full bg-red-500 text-white">{{ missedCount }}</span>
      </button>
      <button class="pill-filter" :class="tab === 'stats' ? 'pill-filter--active' : ''" @click="tab = 'stats'">{{ t('contacts.callsStats') }}</button>
      <span class="flex-1" />
      <select v-if="tab !== 'missed'" v-model="period" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1">
        <option value="today">{{ t('contacts.periodToday') }}</option>
        <option value="7d">{{ t('contacts.period7d') }}</option>
        <option value="30d">{{ t('contacts.period30d') }}</option>
        <option value="all">{{ t('contacts.periodAll') }}</option>
      </select>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto space-y-3">
      <!-- Journal -->
      <template v-if="tab === 'journal'">
        <div class="flex gap-2 flex-wrap items-center">
          <UInput v-model="search" size="sm" icon="lucide:search" :placeholder="t('contacts.callsSearch')" class="w-56" />
          <select v-model="direction" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1">
            <option value="">{{ t('contacts.callsAll') }}</option>
            <option value="IN">{{ t('contacts.callIn') }}</option>
            <option value="OUT">{{ t('contacts.callOut') }}</option>
          </select>
          <select v-model="status" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1">
            <option value="">{{ t('contacts.callsAnyStatus') }}</option>
            <option v-for="s in statusOptions" :key="s" :value="s">{{ t(`contacts.callStatus_${s}`) }}</option>
          </select>
          <label class="text-sm flex items-center gap-1 cursor-pointer"><input v-model="favouritesOnly" type="checkbox"> {{ t('contacts.callFavourites') }}</label>
          <div v-if="list" class="ml-auto text-xs text-gray-500">
            {{ list.info.count }} · {{ t('contacts.callMin') }} {{ mmss(list.minDurationSec) }} · {{ t('contacts.callAvg') }} {{ mmss(list.avgDurationSec) }} · {{ t('contacts.callMax') }} {{ mmss(list.maxDurationSec) }}
          </div>
        </div>

        <AppSkeleton v-if="loading && !list" variant="table" :rows="6" :cols="4" />
        <div v-else-if="list && !list.rows.length" class="text-sm text-gray-500 py-8 text-center">{{ t('contacts.callsEmpty') }}</div>

        <div v-for="c in list?.rows" :key="c.id" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div class="flex items-center gap-3 flex-wrap cursor-pointer" @click="open(c)">
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-2">
                <NuxtLink v-if="c.clientId" :to="`/${nsSlug}/contacts/${c.clientId}`" class="font-medium hover:underline" @click.stop>{{ c.clientName || c.clientPhone }}</NuxtLink>
                <span v-else class="font-medium">{{ c.clientPhone }}</span>
                <span v-if="c.clientId" class="text-xs text-gray-500">{{ c.clientPhone }}</span>
                <span v-if="c.extension" class="text-xs text-gray-400">· {{ c.extension }}</span>
              </div>
              <CallRecord :call="c" />
              <div v-if="c.comment" class="text-xs text-gray-600 dark:text-gray-300">{{ c.comment }}</div>
              <div v-if="c.orderIds.length" class="text-xs text-gray-500">{{ t('contacts.callLinkedOrders') }}: {{ c.orderIds.join(', ') }}</div>
            </div>
            <button class="text-gray-400 hover:text-amber-500" @click.stop="toggleFavourite(c)">
              <UIcon :name="c.favourite ? 'lucide:star' : 'lucide:star'" class="w-5 h-5" :class="c.favourite ? 'text-amber-500 fill-amber-400' : ''" />
            </button>
          </div>
          <div v-if="openId === c.id" class="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div class="flex gap-2 flex-wrap">
              <select :value="draftTemplate" class="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1" @change="pickTemplate(($event.target as HTMLSelectElement).value)">
                <option value="">{{ t('contacts.callTemplate') }}</option>
                <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ tpl.text }}</option>
              </select>
              <div class="flex items-center gap-1 text-sm">
                {{ t('contacts.callRating') }}:
                <button v-for="n in 5" :key="n" @click="draftRating = draftRating === n ? 0 : n">
                  <UIcon name="lucide:star" class="w-4 h-4" :class="n <= draftRating ? 'text-amber-500 fill-amber-400' : 'text-gray-300'" />
                </button>
              </div>
            </div>
            <UTextarea v-model="draftComment" :rows="2" autoresize :placeholder="t('contacts.callComment')" />
            <div class="flex justify-end gap-2">
              <UButton size="xs" color="gray" variant="soft" @click="openId = null">{{ t('common.cancel') }}</UButton>
              <UButton size="xs" @click="saveCall(c)">{{ t('contacts.notesSave') }}</UButton>
            </div>
          </div>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 py-2">
          <UButton size="xs" color="gray" variant="soft" :disabled="page <= 1" icon="lucide:chevron-left" @click="page--" />
          <span class="text-sm">{{ page }} / {{ totalPages }}</span>
          <UButton size="xs" color="gray" variant="soft" :disabled="page >= totalPages" icon="lucide:chevron-right" @click="page++" />
        </div>
      </template>

      <!-- Missed callbacks -->
      <template v-else-if="tab === 'missed'">
        <p class="text-sm text-gray-500">{{ t('contacts.callsMissedHint') }}</p>
        <div v-if="missed && !missed.rows.length" class="text-sm text-gray-500 py-8 text-center">{{ t('contacts.callsMissedEmpty') }}</div>
        <div v-for="c in missed?.rows" :key="c.id" class="rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div class="min-w-0 flex-1">
            <NuxtLink v-if="c.clientId" :to="`/${nsSlug}/contacts/${c.clientId}`" class="font-medium hover:underline">{{ c.clientName || c.clientPhone }}</NuxtLink>
            <span v-else class="font-medium">{{ c.clientPhone }}</span>
            <span v-if="c.clientId" class="text-xs text-gray-500 ml-2">{{ c.clientPhone }}</span>
            <CallRecord :call="c" />
          </div>
          <UButton size="xs" color="emerald" icon="lucide:phone" @click="callBack(c)">{{ t('contacts.callsCallBack') }}</UButton>
          <UButton size="xs" color="gray" variant="soft" icon="lucide:check" @click="done(c)">{{ t('contacts.callbackMark') }}</UButton>
        </div>
      </template>

      <!-- Stats -->
      <template v-else>
        <AppSkeleton v-if="!stats" variant="panel" :rows="2" />
        <template v-else>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="card in [
              { k: 'statsTotal', v: stats.total }, { k: 'statsIncoming', v: stats.incoming },
              { k: 'statsOutgoing', v: stats.outgoing }, { k: 'statsMissed', v: stats.missed },
              { k: 'statsUnreturned', v: stats.missedUnreturned }, { k: 'statsCallbacks', v: stats.callbacksDone },
              { k: 'statsAvgDuration', v: mmss(stats.avgDurationSec) }, { k: 'statsMaxDuration', v: mmss(stats.maxDurationSec) },
            ]" :key="card.k" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <div class="text-xs text-gray-500">{{ t(`contacts.${card.k}`) }}</div>
              <div class="text-2xl font-bold tabular-nums">{{ card.v }}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <h3 class="font-semibold mb-2">{{ t('contacts.statsByDay') }}</h3>
              <div v-for="d in stats.byDay" :key="d.day" class="flex justify-between text-sm py-0.5">
                <span>{{ d.day }}</span><span class="tabular-nums">{{ d.total }} <span v-if="d.missed" class="text-red-600">({{ d.missed }})</span></span>
              </div>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <h3 class="font-semibold mb-2">{{ t('contacts.statsByOperator') }}</h3>
              <div v-for="o in stats.byOperator" :key="o.operatorUserId" class="flex justify-between text-sm py-0.5">
                <span class="truncate">{{ o.operatorUserId.slice(0, 8) }}</span>
                <span class="tabular-nums">{{ o.acceptedIn }} / {{ o.outgoing }} · {{ mmss(o.talkSeconds) }}</span>
              </div>
              <div v-if="!stats.byOperator.length" class="text-sm text-gray-400">—</div>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <h3 class="font-semibold mb-2">{{ t('contacts.statsByLine') }}</h3>
              <div v-for="l in stats.byLine" :key="l.lineNumber + l.source" class="flex justify-between text-sm py-0.5">
                <span class="truncate">{{ l.lineNumber }}<span v-if="l.source" class="text-gray-400"> · {{ l.source }}</span></span><span class="tabular-nums">{{ l.total }}</span>
              </div>
              <div v-if="!stats.byLine.length" class="text-sm text-gray-400">—</div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
