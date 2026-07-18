// Client-page live updates: subscribes to clientChanged events and tracks staleness
// when another session changes the same client. Self-manages its own cleanup.
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useContactsToken } from '@/composables/useContactsToken';
import { subscribeClientChanged } from '@/api/contacts/subscriptions';
import type { ClientRow } from '@/api/contacts/listClients';

export interface UseClientLiveSyncDeps {
  token: Ref<string | null | undefined>;
  selectedNS: Ref<string | undefined>;
  client: Ref<ClientRow | null>;
  currentUserId: Ref<string>;
  loadClient: () => Promise<void>;
}

export function useClientLiveSync(deps: UseClientLiveSyncDeps) {
  const isClientDataStale = ref(false);
  let stopClientSubscription: (() => void) | null = null;

  function markLocalMutation() {
    isClientDataStale.value = false;
  }

  async function initClientSubscription() {
    if (!deps.token.value || !deps.selectedNS.value || !deps.client.value?.client.id) return;

    const { ensure } = useContactsToken();
    const contactsToken = await ensure(deps.selectedNS.value, deps.token.value);
    if (!contactsToken) return;

    if (stopClientSubscription) {
      stopClientSubscription();
      stopClientSubscription = null;
    }

    stopClientSubscription = subscribeClientChanged(
      contactsToken,
      deps.selectedNS.value,
      (event) => {
        // Only handle events for this specific client
        if (event.clientId !== deps.client.value?.client.id) return;

        // Don't show stale banner for our own changes
        if (event.changedBy === deps.currentUserId.value) return;

        isClientDataStale.value = true;
      },
      () => {
        // Fallback is manual reload; no hard failure for the page.
      },
    );
  }

  async function refreshStaleClientData() {
    await deps.loadClient();
    isClientDataStale.value = false;
  }

  watch(
    [() => deps.token.value, () => deps.selectedNS.value, () => deps.client.value?.client.id],
    async () => {
      await initClientSubscription();
    },
  );

  onBeforeUnmount(() => {
    if (stopClientSubscription) {
      stopClientSubscription();
      stopClientSubscription = null;
    }
  });

  return {
    isClientDataStale,
    initClientSubscription,
    markLocalMutation,
    refreshStaleClientData,
  };
}
