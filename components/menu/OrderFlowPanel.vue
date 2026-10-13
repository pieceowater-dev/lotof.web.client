<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { useOrderStages, minutesInStatus, isOverdue, formatDuration } from '@/composables/useOrderStages';
import {
  menuOrderPayments, menuCreateOrderPayment, menuDeleteOrderPayment, menuUpdateOrderPriceStage, menuUpdateOrderUrgent,
  type OrderPayment,
} from '@/api/menu/order/extra';
import type { MenuOrder } from '@/api/menu/order/list';

// Time in status, urgency, the price stage and the payments journal of one
// order, as soft panels in the order card.
const props = defineProps<{
  order: MenuOrder;
  nsSlug: string;
  getToken: () => Promise<string>;
  priceStageEnabled: boolean;
  currency?: string;
  formatDate: (iso: string) => string;
  memberDisplayName: (userId: string) => string;
}>();
const emit = defineEmits<{ (e: 'updated', order: MenuOrder): void }>();

const { t } = useI18n();
const toast = useToast();
const { byId } = useOrderStages();

const payments = ref<OrderPayment[]>([]);
const busy = ref(false);
const amount = ref<number | null>(null);
const method = ref<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH');
const comment = ref('');
const refundMode = ref(false);

const stage = computed(() => byId(props.order.stageId));
const inStatus = computed(() => minutesInStatus(props.order.statusChangedAt));
const overdue = computed(() => isOverdue(props.order, stage.value));
const net = computed(() => props.order.totalAmount - props.order.discountAmount);
const remaining = computed(() => Math.max(0, net.value - props.order.paidAmount));
const money = (v: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(v)}${props.currency ? ' ' + props.currency : ''}`;

async function loadPayments() {
  try {
    payments.value = await menuOrderPayments(await props.getToken(), props.nsSlug, props.order.id);
  } catch (e) {
    logError('[OrderFlowPanel] payments load failed', e);
  }
}
onMounted(loadPayments);
watch(() => props.order.id, loadPayments);

function fail(e: unknown) {
  logError('[OrderFlowPanel] action failed', e);
  toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
}

async function toggleUrgent() {
  busy.value = true;
  try {
    emit('updated', await menuUpdateOrderUrgent(await props.getToken(), props.nsSlug, props.order.id, !props.order.isUrgent));
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function priceStage(stage: 'QUOTED' | 'APPROVED' | 'RESET') {
  busy.value = true;
  try {
    emit('updated', await menuUpdateOrderPriceStage(await props.getToken(), props.nsSlug, props.order.id, stage));
  } catch (e) { fail(e); } finally { busy.value = false; }
}

// One key per click sequence: a double click returns the first payment.
let clickKey = '';
async function addPayment(value?: number) {
  const v = value ?? amount.value ?? 0;
  if (!(v > 0)) return;
  busy.value = true;
  if (!clickKey) clickKey = crypto.randomUUID();
  try {
    const token = await props.getToken();
    await menuCreateOrderPayment(token, props.nsSlug, {
      orderId: props.order.id, amount: v, method: method.value, kind: refundMode.value ? 'REFUND' : 'PAYMENT',
      comment: comment.value.trim() || undefined, idempotencyKey: clickKey,
    });
    amount.value = null; comment.value = ''; clickKey = '';
    await loadPayments();
    const { menuGetOrder } = await import('@/api/menu/order/get');
    const fresh = await menuGetOrder(token, props.nsSlug, props.order.id);
    if (fresh) emit('updated', fresh);
  } catch (e) { clickKey = ''; fail(e); } finally { busy.value = false; }
}

async function removePayment(p: OrderPayment) {
  busy.value = true;
  try {
    emit('updated', await menuDeleteOrderPayment(await props.getToken(), props.nsSlug, p.id, props.order.id));
    await loadPayments();
  } catch (e) { fail(e); } finally { busy.value = false; }
}

const methods: Array<{ key: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'; icon: string; label: string }> = [
  { key: 'CASH', icon: 'lucide:banknote', label: 'menu.payCash' },
  { key: 'CARD', icon: 'lucide:credit-card', label: 'menu.payCard' },
  { key: 'TRANSFER', icon: 'lucide:landmark', label: 'menu.payTransfer' },
  { key: 'OTHER', icon: 'lucide:wallet', label: 'menu.payOther' },
];
</script>

<template>
  <div class="space-y-4">
    <!-- timing + urgency -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <span v-if="inStatus !== null && !order.closedAt" class="at-chip !text-xs" :class="overdue ? '!bg-rose-500/10 !text-rose-600' : ''">
        <Icon name="lucide:timer" class="w-3.5 h-3.5" />{{ t('menu.inStatusFor') }} {{ formatDuration(inStatus) }}<template v-if="overdue"> · {{ t('menu.overdue') }}</template>
      </span>
      <span v-if="order.readyAt" class="at-chip !text-xs"><Icon name="lucide:package-check" class="w-3.5 h-3.5" />{{ t('menu.readySince') }} {{ formatDate(order.readyAt) }}</span>
      <button type="button" class="pill-filter" :class="order.isUrgent ? 'pill-filter--rose' : ''" :disabled="busy" @click="toggleUrgent">
        <Icon name="lucide:flame" class="w-3.5 h-3.5" />{{ t('menu.urgent') }}
      </button>
    </div>

    <!-- price stage -->
    <div v-if="priceStageEnabled" class="at-panel !p-4 space-y-3">
      <div class="flex items-center gap-2">
        <div class="at-h2 flex-1">{{ t('menu.priceStageTitle') }}</div>
        <span v-if="order.priceApprovedAt" class="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-blue-300">{{ t('menu.priceApproved') }}</span>
        <span v-else-if="order.priceQuotedAt" class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">{{ t('menu.priceQuoted') }}</span>
        <span v-else class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{{ t('menu.priceNotQuoted') }}</span>
      </div>
      <div class="text-sm text-slate-500 dark:text-slate-400">
        <template v-if="order.priceQuotedAt">{{ formatDate(order.priceQuotedAt) }}<template v-if="order.priceQuotedBy"> · {{ memberDisplayName(order.priceQuotedBy) }}</template> · {{ money(net) }}</template>
        <template v-else>{{ t('menu.priceStageHint') }}</template>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button type="button" class="at-btn at-btn--blue" :disabled="busy" @click="priceStage('QUOTED')"><Icon name="lucide:megaphone" class="w-4 h-4" />{{ t('menu.priceQuoteAction') }}</button>
        <button type="button" class="at-btn at-btn--primary" :disabled="busy || !order.priceQuotedAt || !!order.priceApprovedAt" @click="priceStage('APPROVED')"><Icon name="lucide:check" class="w-4 h-4" />{{ t('menu.priceApproveAction') }}</button>
        <button v-if="order.priceQuotedAt" type="button" class="at-btn" :disabled="busy" @click="priceStage('RESET')"><Icon name="lucide:rotate-ccw" class="w-4 h-4" />{{ t('menu.priceResetAction') }}</button>
      </div>
    </div>

    <!-- payments journal -->
    <div class="at-panel !p-4 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="at-h2 flex-1">{{ t('menu.paymentsTitle') }}</div>
        <span class="at-chip !text-xs">{{ t('menu.paidOf') }} {{ money(order.paidAmount) }} / {{ money(net) }}</span>
        <span v-if="remaining > 0" class="at-chip !text-xs !bg-amber-500/10 !text-amber-700 dark:!text-amber-300">{{ t('menu.remaining') }} {{ money(remaining) }}</span>
        <span v-else-if="net > 0" class="at-chip !text-xs !bg-accent-100 !text-accent-700 dark:!bg-accent-500/20 dark:!text-blue-300"><Icon name="lucide:check" class="w-3 h-3" />{{ t('menu.paidInFull') }}</span>
      </div>

      <div v-if="payments.length" class="space-y-1.5">
        <div v-for="p in payments" :key="p.id" class="at-row flex items-center gap-3 !py-2 text-sm">
          <Icon :name="p.kind === 'REFUND' ? 'lucide:undo-2' : 'lucide:arrow-down-left'" class="w-4 h-4 shrink-0" :class="p.kind === 'REFUND' ? 'text-rose-500' : 'text-accent-600'" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold tabular-nums" :class="p.kind === 'REFUND' ? 'text-rose-600' : ''">{{ p.kind === 'REFUND' ? '−' : '+' }}{{ money(p.amount) }}</div>
            <div class="text-xs text-slate-500 truncate">{{ formatDate(p.paidAt) }} · {{ t(`menu.pay${p.method.charAt(0)}${p.method.slice(1).toLowerCase()}`) }}<template v-if="p.userId"> · {{ memberDisplayName(p.userId) }}</template><template v-if="p.comment"> · {{ p.comment }}</template></div>
          </div>
          <button type="button" class="cp-icon" :disabled="busy" :aria-label="t('common.delete')" @click="removePayment(p)"><Icon name="lucide:trash-2" class="w-4 h-4" /></button>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex gap-1.5 flex-wrap">
          <button type="button" class="pill-filter" :class="!refundMode ? 'pill-filter--active' : ''" @click="refundMode = false">{{ t('menu.payAccept') }}</button>
          <button type="button" class="pill-filter" :class="refundMode ? 'pill-filter--rose' : ''" @click="refundMode = true">{{ t('menu.payRefund') }}</button>
          <span class="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
          <button v-for="m in methods" :key="m.key" type="button" class="pill-filter" :class="method === m.key ? 'pill-filter--active' : ''" @click="method = m.key">
            <Icon :name="m.icon" class="w-3.5 h-3.5" />{{ t(m.label) }}
          </button>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
          <UInput :model-value="amount ?? ''" type="number" min="0" class="w-40" @update:model-value="(v: any) => (amount = v === '' || v == null ? null : Number(v))" :placeholder="t('menu.payAmount')" @keyup.enter="addPayment()" />
          <UInput v-model="comment" class="flex-1 min-w-40" :placeholder="t('menu.payComment')" />
          <button type="button" class="at-btn at-btn--primary" :disabled="busy || !(amount && amount > 0)" @click="addPayment()">
            <Icon :name="busy ? 'lucide:loader-2' : 'lucide:plus'" class="w-4 h-4" :class="{ 'animate-spin': busy }" />{{ refundMode ? t('menu.payRefund') : t('menu.payAccept') }}
          </button>
          <button v-if="!refundMode && remaining > 0" type="button" class="at-btn at-btn--blue" :disabled="busy" @click="addPayment(remaining)">
            <Icon name="lucide:badge-check" class="w-4 h-4" />{{ t('menu.payFull') }} {{ money(remaining) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
