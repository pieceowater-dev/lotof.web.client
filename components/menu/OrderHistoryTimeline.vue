<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { historyDotStyle } from '@/utils/orderStatus';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
import type { MenuOrderTask } from '@/api/menu/order/tasks';
import { maskProfanity } from '@/utils/profanityFilter';

const { t } = useI18n();

// The server writes service events (price stage, urgency, payments, stage moves)
// as short markers in the history comment; show them as readable sentences.
function friendly(comment: string): string {
  const c = comment.trim();
  const map: Record<string, string> = {
    '[price] quoted': 'menu.histPriceQuoted',
    '[price] approved': 'menu.histPriceApproved',
    '[price] reset': 'menu.histPriceReset',
    '[price] reset (order changed)': 'menu.histPriceAutoReset',
    '[urgent] on': 'menu.histUrgentOn',
    '[urgent] off': 'menu.histUrgentOff',
  };
  if (map[c]) return t(map[c]);
  const pay = c.match(/^\[(payment|refund|payment removed)\] ([\d.]+) (\w+)$/);
  if (pay) {
    const key = pay[1] === 'payment' ? 'menu.histPayment' : pay[1] === 'refund' ? 'menu.histRefund' : 'menu.histPaymentRemoved';
    return `${t(key)}: ${pay[2]} · ${t('menu.pay' + pay[3].charAt(0) + pay[3].slice(1).toLowerCase())}`;
  }
  if (c.startsWith('Stage: ')) return c.slice(7);
  return maskProfanity(c);
}

const props = defineProps<{
  history: MenuOrderHistoryEntry[];
  // Linked Issues tasks: their creation and completion show up in the same timeline.
  tasks?: MenuOrderTask[];
  statusLabel: (s: string) => string;
  memberDisplayName: (userId: string) => string;
  formatDate: (iso: string) => string;
}>();

type Row =
  | { kind: 'status'; at: string; id: string; h: MenuOrderHistoryEntry }
  | { kind: 'task'; at: string; id: string; text: string; done: boolean };
const rows = computed<Row[]>(() => {
  const out: Row[] = props.history.map((h) => ({ kind: 'status', at: h.createdAt, id: h.id, h }));
  for (const tk of props.tasks || []) {
    const code = `${tk.boardSlug ? tk.boardSlug.toUpperCase() + '-' : '#'}${tk.taskNumber}`;
    if (tk.createdAt) out.push({ kind: 'task', at: tk.createdAt, id: `${tk.taskId}-c`, text: `${t('menu.histTaskCreated')}: ${code} ${tk.title}`, done: false });
    if (tk.closedAt) out.push({ kind: 'task', at: tk.closedAt, id: `${tk.taskId}-d`, text: `${t('menu.histTaskDone')}: ${code} ${tk.title}`, done: true });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
});
</script>

<template>
  <div>
    <div v-if="!rows.length" class="text-sm text-gray-400">{{ t('menu.noHistory') || 'No history yet' }}</div>
    <ol v-else class="relative">
      <li v-for="(r, idx) in rows" :key="r.id" class="relative pl-8" :class="idx !== rows.length - 1 ? 'pb-6' : ''">
        <span v-if="idx !== rows.length - 1" class="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
        <template v-if="r.kind === 'status'">
          <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0" :class="historyDotStyle(r.h.newStatus).bg">
            <Icon name="lucide:circle" class="w-2 h-2" :class="historyDotStyle(r.h.newStatus).dot" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium">{{ statusLabel(r.h.newStatus) }}</div>
            <div class="text-xs text-gray-400">{{ formatDate(r.h.createdAt) }}</div>
            <div v-if="r.h.userId" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ memberDisplayName(r.h.userId) }}</div>
            <div v-if="r.h.comment" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ friendly(r.h.comment) }}</div>
          </div>
        </template>
        <template v-else>
          <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 bg-gray-100 dark:bg-gray-800">
            <Icon :name="r.done ? 'lucide:check' : 'lucide:list-todo'" class="w-3.5 h-3.5 text-gray-500" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium">{{ r.text }}</div>
            <div class="text-xs text-gray-400">{{ formatDate(r.at) }}</div>
          </div>
        </template>
      </li>
    </ol>
  </div>
</template>
