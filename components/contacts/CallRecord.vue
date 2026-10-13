<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { Call } from '@/api/contacts/telephony';

const props = defineProps<{ call: Call }>();
const { t } = useI18n();

const statusKey = computed(() => (props.call.inProgress && !props.call.status ? 'IN_PROGRESS' : props.call.status || 'UNKNOWN'));
const tone = computed(() => {
  switch (statusKey.value) {
    case 'ACCEPTED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'MISSED': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200';
    case 'IN_PROGRESS': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
});

function fmtDuration(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A recording is a link at the provider; anything else is a provider reference.
const recordingUrl = computed(() => (props.call.recordingRef && /^https?:\/\//.test(props.call.recordingRef) ? props.call.recordingRef : ''));
</script>

<template>
  <div class="flex items-center gap-2 text-sm flex-wrap">
    <UIcon :name="call.direction === 'OUT' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'" class="w-4 h-4 text-gray-500" />
    <span class="text-xs px-2 py-0.5 rounded-full" :class="tone">{{ t(`contacts.callStatus_${statusKey}`) }}</span>
    <span class="text-gray-500 tabular-nums">{{ fmtDuration(call.durationSec) }}</span>
    <span class="text-gray-500">{{ new Date(call.startedAt).toLocaleString() }}</span>
    <span v-if="call.firstFromNumber" class="text-[11px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{{ t('contacts.callFirst') }}</span>
    <a v-if="recordingUrl" :href="recordingUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 hover:underline">
      <UIcon name="lucide:play-circle" class="w-4 h-4" />{{ t('contacts.callRecording') }}
    </a>
  </div>
</template>
