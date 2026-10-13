<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { subscribeCallEvents } from '@/api/contacts/subscriptions';
import type { CallCardEvent } from '@/api/contacts/telephony';
import CallWidget from '@/components/contacts/CallWidget.vue';

// Listens for live call events of the current namespace and feeds the floating
// widget. Mounted by the workspace layout, so the card shows over every app,
// not only inside Contacts. Namespaces without Contacts simply get no events.
const route = useRoute();
const { ctx } = useCrmAuth();

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
  // A finished call closes its card after a moment (also when another operator took it).
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

function disconnect() {
  dispose?.();
  dispose = null;
}

async function connect() {
  disconnect();
  if (!process.client || !nsSlug.value) return;
  try {
    const c = await ctx();
    if (!c) return;
    dispose = subscribeCallEvents(c.token, c.ns, onEvent, undefined);
  } catch {
    // no Contacts access in this namespace: nothing to show
  }
}

onMounted(connect);
watch(nsSlug, () => { cards.value = {}; connect(); });
onBeforeUnmount(() => {
  disconnect();
  Object.values(timers).forEach(clearTimeout);
});

const list = computed(() => Object.values(cards.value));
</script>

<template>
  <CallWidget :cards="list" :ns-slug="nsSlug" @dismiss="dismiss" />
</template>
