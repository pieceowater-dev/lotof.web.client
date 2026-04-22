import { createClient, type Client } from 'graphql-ws';
import { getApiWsUrl } from '@/utils/api-base';

function createContactsSubscriptionsClient(contactsToken: string, namespace: string): Client {
  return createClient({
    url: getApiWsUrl('contacts', '/query'),
    lazy: true,
    connectionParams: {
      ContactsAuthorization: `Bearer ${contactsToken}`,
      Namespace: namespace,
    },
  });
}

type Disposable = () => void;

export type ClientChangedEvent = {
  clientId: string;
  changedBy: string;
  action: string;
  changedAt: string;
};

export function subscribeClientChanged(
  contactsToken: string,
  namespace: string,
  onEvent: (event: ClientChangedEvent) => void,
  onError?: (error: unknown) => void,
): Disposable {
  if (!process.client || !contactsToken || !namespace) return () => {};

  const client = createContactsSubscriptionsClient(contactsToken, namespace);
  const unsubscribe = client.subscribe(
    {
      query: `
        subscription ClientChanged {
          clientChanged {
            clientId
            changedBy
            action
            changedAt
          }
        }
      `,
    },
    {
      next: (result: any) => {
        const event = result?.data?.clientChanged;
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

