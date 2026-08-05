import { createClient, type Client } from 'graphql-ws';
import { getApiWsUrl } from '@/utils/api-base';

function createTasksSubscriptionsClient(tasksToken: string, namespace: string): Client {
  return createClient({
    url: getApiWsUrl('tasks', '/query'),
    lazy: true,
    connectionParams: {
      IssuesAuthorization: `Bearer ${tasksToken}`,
      Namespace: namespace,
    },
  });
}

type Disposable = () => void;

export type TaskChangedEvent = {
  taskId: string;
  boardId: string;
  action: string;
  changedBy?: string | null;
  changedAt: string;
};

export function subscribeTaskChanged(
  tasksToken: string,
  namespace: string,
  boardId: string,
  onEvent: (event: TaskChangedEvent) => void,
  onError?: (error: unknown) => void,
): Disposable {
  if (!process.client || !tasksToken || !namespace || !boardId) return () => {};

  const client = createTasksSubscriptionsClient(tasksToken, namespace);
  const unsubscribe = client.subscribe(
    {
      query: `
        subscription TaskChanged($boardId: ID!) {
          taskChanged(boardId: $boardId) {
            taskId
            boardId
            action
            changedBy
            changedAt
          }
        }
      `,
      variables: { boardId },
    },
    {
      next: (result: any) => {
        const event = result?.data?.taskChanged;
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
