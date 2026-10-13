<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { useAuth } from '@/composables/useAuth';
import { subscribeCallEvents } from '@/api/contacts/subscriptions';
import type { CallCardEvent } from '@/api/contacts/telephony';

// The live call card: shows who is calling while the call rings or talks.
// Mounted by the workspace layout, active only inside the Contacts app.
const route = useRoute();
const { t } = useI18n();
const { ctx } = useCrmAuth();
const { user } = useAuth();

const active = computed(() => /^\/[^/]+\/contacts(\/|$)/.test(route.path));
const nsSlug = computed(() => (route.params.namespace as string) || '');

const cards = ref<Record<string, CallCardEvent>>({});
let dispose: (() => void) | null = null;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function dismiss(id: string) {
  const next = { ...cards.value };
  delete next[id];
  cards.value = next;
  clearTimeout(timers[id]);
}

function onEvent(ev: CallCardEvent) {
  const id = ev.call.id;
  // A finished call closes its card (also when another operator took it).
  if (!ev.call.inProgress && ev.call.status) {
    if (cards.value[id]) {
      cards.value = { ...cards.value, [id]: ev };
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => dismiss(id), 8000);
    }
    return;
  }
  cards.value = { ...cards.value, [id]: ev };
}

async function connect() {
  disconnect();
  if (!process.client || !active.value || !nsSlug.value) return;
  const c = await ctx();
  if (!c) return;
  // Operators see their own calls (and unassigned ones); admins see all via no filter.
  dispose = subscribeCallEvents(c.token, c.ns, onEvent, undefined);
}

function disconnect() {
  dispose?.();
  dispose = null;
}

onMounted(connect);
watch([active, nsSlug], connect);
onBeforeUnmount(() => {
  disconnect();
  Object.values(timers).forEach(clearTimeout);
});

const list = computed(() => Object.values(cards.value));
void user;
</script>

<template>
  <div v-if="active && list.length" class="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-[min(22rem,calc(100vw-2rem))]">
    <div
      v-for="ev in list"
      :key="ev.call.id"
      class="rounded-2xl shadow-2xl border bg-white dark:bg-gray-800 p-4"
      :class="ev.call.inProgress ? 'border-emerald-400' : 'border-gray-200 dark:border-gray-700'"
    >
      <div class="flex items-start gap-2">
        <UIcon
          :name="ev.call.direction === 'OUT' ? 'lucide:phone-outgoing' : 'lucide:phone-incoming'"
          class="w-5 h-5 mt-0.5"
          :class="ev.call.inProgress ? 'text-emerald-500 animate-pulse' : 'text-gray-400'"
        />
        <div class="min-w-0 flex-1">
          <div class="text-xs text-gray-500">
            {{ ev.call.direction === 'OUT' ? t('contacts.liveOutgoing') : t('contacts.liveIncoming') }}
            <span v-if="ev.call.inProgress">· {{ ev.eventType === 'accepted' ? t('contacts.liveTalking') : t('contacts.liveRinging') }}</span>
            <span v-else-if="ev.call.status">· {{ t(`contacts.callStatus_${ev.call.status}`) }}</span>
          </div>
          <div class="font-semibold truncate">
            {{ ev.clientKnown ? (ev.clientName || ev.call.clientPhone) : t('contacts.liveUnknown') }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300">{{ ev.call.clientPhone }}</div>
          <div v-if="ev.call.firstFromNumber" class="text-xs text-violet-600 dark:text-violet-300 mt-0.5">{{ t('contacts.callFirst') }}</div>
        </div>
        <button class="text-gray-400 hover:text-gray-700 dark:hover:text-white" @click="dismiss(ev.call.id)">
          <UIcon name="lucide:x" class="w-4 h-4" />
        </button>
      </div>
      <div class="mt-3 flex gap-2">
        <UButton
          v-if="ev.clientKnown && ev.call.clientId"
          size="xs"
          :to="`/${nsSlug}/contacts/${ev.call.clientId}`"
          icon="lucide:user"
        >
          {{ t('contacts.liveOpenClient') }}
        </UButton>
        <UButton
          v-else
          size="xs"
          color="primary" variant="soft"
          :to="`/${nsSlug}/contacts/new?phone=${encodeURIComponent(ev.call.clientPhone)}`"
          icon="lucide:user-plus"
        >
          {{ t('contacts.liveCreateClient') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
