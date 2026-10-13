<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { logError } from '@/utils/logger';
import { listCalls, type Call } from '@/api/contacts/telephony';
import CallRecord from '@/components/contacts/CallRecord.vue';

const props = defineProps<{ clientId?: string }>();
const { t } = useI18n();
const { ctx } = useCrmAuth();

const calls = ref<Call[]>([]);
const loading = ref(false);

async function load() {
  if (!props.clientId) return;
  const c = await ctx();
  if (!c) return;
  loading.value = true;
  try {
    calls.value = (await listCalls(c.token, c.ns, { clientId: props.clientId, pagination: { page: 1, length: 'TWENTY' } })).rows;
  } catch (e) {
    logError('Failed to load calls:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.clientId, load);
</script>

<template>
  <div v-if="loading || calls.length" class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <UIcon name="lucide:phone-call" class="w-5 h-5 text-emerald-500" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('contacts.callsOfClient') }}</h2>
    </div>
    <div class="px-5 py-4 space-y-3">
      <div v-for="c in calls" :key="c.id" class="space-y-0.5">
        <CallRecord :call="c" />
        <div v-if="c.comment" class="text-xs text-gray-600 dark:text-gray-300 pl-6">{{ c.comment }}</div>
      </div>
    </div>
  </div>
</template>
