import { createClient, type Client } from 'graphql-ws';

function toWsUrl(httpBase: string): string {
  if (httpBase.startsWith('https://')) return httpBase.replace('https://', 'wss://') + '/query';
  if (httpBase.startsWith('http://')) return httpBase.replace('http://', 'ws://') + '/query';
  return httpBase + '/query';
}

function createContactsSubscriptionsClient(contactsToken: string, namespace: string): Client {
  const base = import.meta.env.VITE_API_CONTACTS as string;
  return createClient({
    url: toWsUrl(base),
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

