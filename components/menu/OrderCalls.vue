<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { logError } from '@/utils/logger';
import { listCalls, attachClientCallsToOrder, unlinkCall, type Call } from '@/api/contacts/telephony';
import CallRecord from '@/components/contacts/CallRecord.vue';

// Calls of an order (lota Contacts telephony). When the order gets its client,
// the client's earlier unlinked calls are pulled in once; a call detached by
// hand is never re-attached. Hidden when Contacts is not available.
const props = defineProps<{ orderId: string; clientId?: string | null }>();
const { t } = useI18n();
const { ctx } = useCrmAuth();

const calls = ref<Call[]>([]);
const available = ref(true);
const busy = ref(false);

async function load() {
  try {
    const c = await ctx();
    if (!c) { available.value = false; return; }
    calls.value = (await listCalls(c.token, c.ns, { orderId: props.orderId, pagination: { page: 1, length: 'FIFTY' } })).rows;
  } catch (e) {
    available.value = false; // Contacts is not installed in this namespace
    logError('[OrderCalls] load failed', e);
  }
}

async function attachOnce() {
  if (!props.clientId || !process.client) return;
  const key = `order-calls-attached:${props.orderId}`;
  try { if (localStorage.getItem(key)) return; } catch { /* ignore */ }
  try {
    const c = await ctx();
    if (!c) return;
    await attachClientCallsToOrder(c.token, c.ns, props.clientId, props.orderId);
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  } catch (e) {
    logError('[OrderCalls] attach failed', e);
  }
}

async function pullClientCalls() {
  if (!props.clientId) return;
  busy.value = true;
  try {
    const c = await ctx();
    if (c) await attachClientCallsToOrder(c.token, c.ns, props.clientId, props.orderId);
    await load();
  } finally { busy.value = false; }
}

async function detach(call: Call) {
  const c = await ctx();
  if (!c) return;
  await unlinkCall(c.token, c.ns, call.id, props.orderId);
  await load();
}

onMounted(async () => { await attachOnce(); await load(); });
watch(() => [props.orderId, props.clientId], async () => { await attachOnce(); await load(); });
</script>

<template>
  <div v-if="available && (calls.length || clientId)" class="at-panel !p-4 space-y-3">
    <div class="flex items-center gap-2">
      <div class="at-h2 flex-1">{{ t('menu.orderCallsTitle') }}</div>
      <button v-if="clientId" type="button" class="at-btn at-btn--blue !px-3 !py-1.5" :disabled="busy" @click="pullClientCalls">
        <Icon :name="busy ? 'lucide:loader-2' : 'lucide:phone-incoming'" class="w-4 h-4" :class="{ 'animate-spin': busy }" />{{ t('menu.orderCallsPull') }}
      </button>
    </div>
    <p v-if="!calls.length" class="text-sm text-slate-500">{{ t('menu.orderCallsEmpty') }}</p>
    <div v-for="c in calls" :key="c.id" class="at-row !py-2.5 space-y-1">
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1"><CallRecord :call="c" /></div>
        <button type="button" class="cp-icon" :aria-label="t('menu.orderCallsDetach')" :title="t('menu.orderCallsDetach')" @click="detach(c)"><Icon name="lucide:unlink" class="w-4 h-4" /></button>
      </div>
      <p v-if="c.comment" class="text-xs text-slate-600 dark:text-slate-300">{{ c.comment }}</p>
    </div>
  </div>
</template>
