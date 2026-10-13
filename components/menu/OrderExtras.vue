<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { menuUpdateOrderExtras } from '@/api/menu/order/extra';
import type { MenuOrder } from '@/api/menu/order/list';

// Follow-up date, customer recommendation and internal notes of an order.
const props = defineProps<{ order: MenuOrder; nsSlug: string; getToken: () => Promise<string> }>();
const emit = defineEmits<{ (e: 'updated', order: MenuOrder): void }>();
const { t } = useI18n();
const toast = useToast();

const day = ref('');
const recommendation = ref('');
const internalNotes = ref('');
const busy = ref(false);

function sync() {
  day.value = props.order.nextContactAt ? props.order.nextContactAt.slice(0, 10) : '';
  recommendation.value = props.order.recommendation || '';
  internalNotes.value = props.order.internalNotes || '';
}
watch(() => props.order.id, sync, { immediate: true });

const dirty = computed(() =>
  day.value !== (props.order.nextContactAt ? props.order.nextContactAt.slice(0, 10) : '')
  || recommendation.value !== (props.order.recommendation || '')
  || internalNotes.value !== (props.order.internalNotes || ''));

const due = computed(() => !!day.value && !props.order.closedAt && day.value <= new Date().toISOString().slice(0, 10));

async function save() {
  busy.value = true;
  try {
    const o = await menuUpdateOrderExtras(await props.getToken(), props.nsSlug, {
      orderId: props.order.id,
      nextContactAt: day.value ? new Date(`${day.value}T09:00:00`).toISOString() : null,
      recommendation: recommendation.value,
      internalNotes: internalNotes.value,
    });
    emit('updated', o);
  } catch (e) {
    logError('[OrderExtras] save failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally { busy.value = false; }
}
</script>

<template>
  <div class="at-panel !p-4 space-y-3">
    <div class="flex items-center gap-2">
      <div class="at-h2 flex-1">{{ t('menu.followUpTitle') }}</div>
      <span v-if="due" class="at-chip !text-xs !bg-rose-500/10 !text-rose-600"><Icon name="lucide:phone-forwarded" class="w-3.5 h-3.5" />{{ t('menu.contactDueNow') }}</span>
    </div>
    <div class="space-y-1">
      <label class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ t('menu.nextContact') }}</label>
      <div class="flex items-center gap-2">
        <UInput v-model="day" type="date" class="flex-1" />
        <button v-if="day" type="button" class="cp-icon" :title="t('common.clear')" @click="day = ''"><Icon name="lucide:x" class="w-4 h-4" /></button>
      </div>
    </div>
    <div class="space-y-1">
      <label class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ t('menu.recommendation') }}</label>
      <UTextarea v-model="recommendation" :rows="2" autoresize :placeholder="t('menu.recommendationHint')" />
    </div>
    <div class="space-y-1">
      <label class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ t('menu.internalNotes') }}</label>
      <UTextarea v-model="internalNotes" :rows="2" autoresize :placeholder="t('menu.internalNotesHint')" />
    </div>
    <div v-if="dirty" class="flex justify-end">
      <button type="button" class="at-btn at-btn--primary" :disabled="busy" @click="save">
        <Icon :name="busy ? 'lucide:loader-2' : 'lucide:check'" class="w-4 h-4" :class="{ 'animate-spin': busy }" />{{ t('common.save') }}
      </button>
    </div>
  </div>
</template>
