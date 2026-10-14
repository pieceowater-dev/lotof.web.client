<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { menuMyOrderCards, menuCreateOrderCard, menuDeleteOrderCard, type OrderCardDef } from '@/api/menu/order/extra';

// Personal counter cards: a saved filter with a live count, kept on the
// server per user (up to 8). Renders as extra cards inside the cards strip.
export type CardFilter = { statuses?: string[]; quick?: '' | 'urgent' | 'overdue' | 'ready' | 'contact'; mine?: boolean };

const props = defineProps<{
  nsSlug: string;
  getToken: () => Promise<string>;
  userId?: string;
  branchIds?: string[];
  current: CardFilter; // what the list is filtered by right now
  refreshKey?: number;
  // 'cards' draws the saved counters in the tiles strip; 'save' draws only the save control (for the filter toolbar).
  mode?: 'cards' | 'save';
}>();
const emit = defineEmits<{ (e: 'apply', f: CardFilter): void; (e: 'saved'): void }>();

const { t } = useI18n();
const toast = useToast();
const cards = ref<Array<OrderCardDef & { parsed: CardFilter; count: number | null }>>([]);
const naming = ref(false);
const name = ref('');
const saving = ref(false);

const canSave = computed(() => !!(props.current.statuses?.length || props.current.quick || props.current.mine) && cards.value.length < 8);
const sameAsCurrent = (f: CardFilter) =>
  JSON.stringify([[...(f.statuses || [])].sort(), f.quick || '', !!f.mine]) === JSON.stringify([[...(props.current.statuses || [])].sort(), props.current.quick || '', !!props.current.mine]);

function parse(raw: string): CardFilter {
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

async function countFor(f: CardFilter): Promise<number | null> {
  try {
    const { menuOrdersList } = await import('@/api/menu/order/list');
    const res = await menuOrdersList(await props.getToken(), props.nsSlug, {
      statuses: f.statuses?.length ? f.statuses : undefined,
      urgent: f.quick === 'urgent' || undefined,
      overdue: f.quick === 'overdue' || undefined,
      readyOnly: f.quick === 'ready' || undefined,
      contactDue: f.quick === 'contact' || undefined,
      participantUserId: f.mine ? props.userId : undefined,
      branchIds: props.branchIds,
      length: 'TEN',
    });
    return res.count;
  } catch (e) {
    logError('[MyOrderCards] count failed', e);
    return null;
  }
}

async function load() {
  try {
    const defs = await menuMyOrderCards(await props.getToken(), props.nsSlug);
    cards.value = defs.map((d) => ({ ...d, parsed: parse(d.filter), count: null }));
    if (props.mode !== 'save') await Promise.all(cards.value.map(async (c) => { c.count = await countFor(c.parsed); }));
  } catch (e) {
    // Menu gateway without cards yet, or no access: just show nothing.
    logError('[MyOrderCards] load failed', e);
  }
}
onMounted(load);
watch(() => [props.refreshKey, props.nsSlug], load);

async function save() {
  const n = name.value.trim();
  if (!n) return;
  saving.value = true;
  try {
    const filter = JSON.stringify({ statuses: props.current.statuses || [], quick: props.current.quick || '', mine: !!props.current.mine });
    await menuCreateOrderCard(await props.getToken(), props.nsSlug, n, filter);
    naming.value = false; name.value = '';
    await load();
    emit('saved');
  } catch (e) {
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally { saving.value = false; }
}

async function remove(c: OrderCardDef) {
  try {
    await menuDeleteOrderCard(await props.getToken(), props.nsSlug, c.id);
    cards.value = cards.value.filter((x) => x.id !== c.id);
  } catch (e) {
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  }
}
</script>

<template>
  <template v-if="mode !== 'save'">
  <button
    v-for="c in cards"
    :key="c.id"
    type="button"
    class="group relative flex-shrink-0 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 min-w-[116px] text-left transition-all duration-200"
    :class="sameAsCurrent(c.parsed) ? 'border-violet-300 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/30' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'"
    @click="emit('apply', c.parsed)"
  >
    <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40"><Icon name="lucide:bookmark" class="h-4 w-4 text-violet-600 dark:text-violet-300" /></span>
    <span>
      <span class="block max-w-[110px] truncate text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ c.name }}</span>
      <span class="block text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">{{ c.count ?? '–' }}</span>
    </span>
    <span
      role="button"
      tabindex="0"
      class="absolute right-1.5 top-1.5 rounded-full p-0.5 text-gray-400 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
      :aria-label="t('common.delete')"
      @click.stop="remove(c)"
      @keydown.enter.stop="remove(c)"
    ><Icon name="lucide:x" class="h-3 w-3" /></span>
  </button>

  </template>

  <!-- Save the current filter as a counter card: a compact control for the filter toolbar -->
  <div v-else-if="canSave" class="flex flex-shrink-0 items-center">
    <div v-if="naming" class="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-1 dark:border-gray-800 dark:bg-gray-900">
      <UInput v-model="name" size="xs" maxlength="60" autofocus :placeholder="t('menu.cardName')" class="w-36" @keydown.enter="save" @keydown.esc="naming = false" />
      <button type="button" class="cp-icon" :disabled="saving || !name.trim()" :aria-label="t('common.save')" @click="save"><Icon name="lucide:check" class="w-4 h-4" /></button>
      <button type="button" class="cp-icon" :aria-label="t('common.cancel')" @click="naming = false"><Icon name="lucide:x" class="w-4 h-4" /></button>
    </div>
    <button v-else type="button" class="at-btn !px-3 !py-2 whitespace-nowrap" :title="t('menu.cardSave')" @click="naming = true"><Icon name="lucide:bookmark-plus" class="w-4 h-4" /><span class="hidden lg:inline">{{ t('menu.cardSave') }}</span></button>
  </div>
</template>
