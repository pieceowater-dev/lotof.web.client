<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCallPlayer } from '@/composables/useCallPlayer';
import type { Call } from '@/api/contacts/telephony';

// One call as a compact line: direction tile, result badge, length, time and a
// "Listen" pill that hands the recording to the floating player.
const props = defineProps<{ call: Call }>();
const { t } = useI18n();
const { state, play } = useCallPlayer();

const statusKey = computed(() => (props.call.inProgress && !props.call.status ? 'IN_PROGRESS' : props.call.status || 'UNKNOWN'));
const tone = computed(() => {
  switch (statusKey.value) {
    case 'ACCEPTED': return 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-blue-300';
    case 'MISSED': return 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300';
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  }
});

function fmtDuration(sec: number) {
  if (!sec) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const hasRecording = computed(() => !!props.call.recordingRef);
const isCurrent = computed(() => state.value.call?.id === props.call.id);
const listen = () => play({
  id: props.call.id, clientName: props.call.clientName, clientPhone: props.call.clientPhone,
  startedAt: props.call.startedAt, durationSec: props.call.durationSec, direction: props.call.direction,
});
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap text-sm">
    <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-white/10 dark:text-blue-300">
      <Icon :name="call.direction === 'OUT' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'" class="h-3.5 w-3.5" />
    </span>
    <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="tone">{{ t(`contacts.callStatus_${statusKey}`) }}</span>
    <span v-if="call.durationSec" class="tabular-nums text-slate-500 dark:text-slate-400">{{ fmtDuration(call.durationSec) }}</span>
    <span class="text-slate-500 dark:text-slate-400">{{ new Date(call.startedAt).toLocaleString() }}</span>
    <span v-if="call.firstFromNumber" class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">{{ t('contacts.callFirst') }}</span>
    <button
      v-if="hasRecording"
      type="button"
      class="at-btn at-btn--blue !px-3 !py-1.5"
      :class="isCurrent ? 'ring-2 ring-blue-400/50' : ''"
      @click="listen"
    >
      <Icon :name="isCurrent && state.src ? 'lucide:audio-lines' : 'lucide:play'" class="h-4 w-4" />
      {{ t('contacts.callPlay') }}
    </button>
  </div>
</template>
