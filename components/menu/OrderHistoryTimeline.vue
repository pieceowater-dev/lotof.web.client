<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { historyDotStyle } from '@/utils/orderStatus';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
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

defineProps<{
  history: MenuOrderHistoryEntry[];
  statusLabel: (s: string) => string;
  memberDisplayName: (userId: string) => string;
  formatDate: (iso: string) => string;
}>();
</script>

<template>
  <div>
    <div v-if="!history.length" class="text-sm text-gray-400">{{ t('menu.noHistory') || 'No history yet' }}</div>
    <ol v-else class="relative">
      <li v-for="(h, idx) in history" :key="h.id" class="relative pl-8" :class="idx !== history.length - 1 ? 'pb-6' : ''">
        <span v-if="idx !== history.length - 1" class="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
        <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0" :class="historyDotStyle(h.newStatus).bg">
          <Icon name="lucide:circle" class="w-2 h-2" :class="historyDotStyle(h.newStatus).dot" />
        </span>
        <div class="min-w-0">
          <div class="text-sm font-medium">{{ statusLabel(h.newStatus) }}</div>
          <div class="text-xs text-gray-400">{{ formatDate(h.createdAt) }}</div>
          <div v-if="h.userId" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ memberDisplayName(h.userId) }}</div>
          <div v-if="h.comment" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ friendly(h.comment) }}</div>
        </div>
      </li>
    </ol>
  </div>
</template>
