import { createClient, type Client } from 'graphql-ws';
import { getApiWsUrl } from '@/utils/api-base';

// Live calendar updates — mirrors api/menu/subscriptions.ts. The plans app
// token rides in the connection_init payload (graphql-ws), which the gateway's
// @plansAuth directive reads via its WSTokenContextKey fallback.
function createPlansSubscriptionsClient(plansToken: string, namespace: string): Client {
  return createClient({
    url: getApiWsUrl('plans', '/query'),
    lazy: true,
    retryAttempts: 20,
    connectionParams: {
      PlansAuthorization: `Bearer ${plansToken}`,
      Namespace: namespace,
    },
  });
}

export type BookingChangedEvent = { bookingId: string; action: string; at: string };
type Disposable = () => void;

export function subscribeBookingChanged(
  plansToken: string,
  namespace: string,
  onEvent: (e: BookingChangedEvent) => void,
  onError?: (err: unknown) => void,
): Disposable {
  if (!process.client || !plansToken || !namespace) return () => {};

  const client = createPlansSubscriptionsClient(plansToken, namespace);
  const unsubscribe = client.subscribe(
    { query: `subscription BookingChanged { bookingChanged { bookingId action at } }` },
    {
      next: (result: any) => {
        const e = result?.data?.bookingChanged;
        if (e) onEvent(e);
      },
      error: (err) => onError?.(err),
      complete: () => {},
    },
  );

  return () => {
    try { unsubscribe(); } catch {}
    try { client.dispose(); } catch {}
  };
}
