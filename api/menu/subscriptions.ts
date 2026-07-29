import { createClient, type Client } from 'graphql-ws';
import { getApiWsUrl } from '@/utils/api-base';

function createMenuSubscriptionsClient(menuToken: string, namespace: string): Client {
  return createClient({
    url: getApiWsUrl('menu', '/query'),
    lazy: true,
    connectionParams: {
      MenuAuthorization: `Bearer ${menuToken}`,
      Namespace: namespace,
    },
  });
}

type Disposable = () => void;

export type OrderChangedEvent = {
  orderId: string;
  action: string;
  changedBy?: string | null;
  changedAt: string;
};

export function subscribeOrderChanged(
  menuToken: string,
  namespace: string,
  onEvent: (event: OrderChangedEvent) => void,
  onError?: (error: unknown) => void,
): Disposable {
  if (!process.client || !menuToken || !namespace) return () => {};

  const client = createMenuSubscriptionsClient(menuToken, namespace);
  const unsubscribe = client.subscribe(
    {
      query: `
        subscription OrderChanged {
          orderChanged {
            orderId
            action
            changedBy
            changedAt
          }
        }
      `,
    },
    {
      next: (result: any) => {
        const event = result?.data?.orderChanged;
        if (event) onEvent(event);
      },
      error: (error) => {
        if (onError) onError(error);
      },
      complete: () => {},
    },
  );

  return () => {
    unsubscribe();
    client.dispose();
  };
}
