// Client-page timeline: pagination and de-duplication of client events.
import { computed, ref } from 'vue';
import { getClientEvents, type ClientEvent } from '@/api/contacts/events';
import { logError } from '@/utils/logger';

const EVENTS_PAGE_SIZE = 30;

export function useClientEvents() {
  const events = ref<ClientEvent[]>([]);
  const eventsTotal = ref(0);
  const eventsLoadingMore = ref(false);
  const fullClientIdForEvents = ref('');

  const hasMoreEvents = computed(() => events.value.length < eventsTotal.value);

  function sortEventsByDateDesc(rows: ClientEvent[]): ClientEvent[] {
    return rows.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function mergeUniqueEvents(existingRows: ClientEvent[], incomingRows: ClientEvent[]): ClientEvent[] {
    const byId = new Map<string, ClientEvent>();
    for (const row of existingRows) {
      byId.set(row.id, row);
    }
    for (const row of incomingRows) {
      byId.set(row.id, row);
    }
    return sortEventsByDateDesc(Array.from(byId.values()));
  }

  // Loads the first page of events for a client, by full UUID, falling back
  // to the events already embedded in the aggregated page-data response.
  async function loadInitialEvents(contactsToken: string, fullClientId: string, fallbackEvents: ClientEvent[]) {
    fullClientIdForEvents.value = fullClientId;
    events.value = [];
    eventsTotal.value = 0;

    try {
      const eventsData = await getClientEvents(contactsToken, fullClientId, EVENTS_PAGE_SIZE, 0);
      events.value = sortEventsByDateDesc(eventsData.rows || []);
      eventsTotal.value = Number(eventsData.info?.count || events.value.length);
    } catch (eventsError) {
      logError('Failed to load client events by full client id:', eventsError);
      events.value = sortEventsByDateDesc(fallbackEvents || []);
      eventsTotal.value = events.value.length;
    }
  }

  async function loadMoreEvents(contactsAppToken: string) {
    if (!contactsAppToken || !fullClientIdForEvents.value || eventsLoadingMore.value) {
      return;
    }
    if (eventsTotal.value > 0 && events.value.length >= eventsTotal.value) {
      return;
    }

    try {
      eventsLoadingMore.value = true;
      const eventsData = await getClientEvents(
        contactsAppToken,
        fullClientIdForEvents.value,
        EVENTS_PAGE_SIZE,
        events.value.length,
      );

      const nextRows = sortEventsByDateDesc(eventsData.rows || []);
      events.value = mergeUniqueEvents(events.value, nextRows);
      eventsTotal.value = Number(eventsData.info?.count || 0);
    } catch (eventsError) {
      logError('Failed to load more client events by full client id:', eventsError);
    } finally {
      eventsLoadingMore.value = false;
    }
  }

  return {
    events,
    eventsTotal,
    eventsLoadingMore,
    fullClientIdForEvents,
    hasMoreEvents,
    sortEventsByDateDesc,
    mergeUniqueEvents,
    loadInitialEvents,
    loadMoreEvents,
  };
}
