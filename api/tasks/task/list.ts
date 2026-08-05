import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface TaskItem {
  id: string;
  boardId: string;
  taskTypeId: string;
  title: string;
  description?: string | null;
  status: string;
  assigneeUserId?: string | null;
  priority: number;
  textAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  clientNameSnapshot?: string | null;
  clientPhoneSnapshot?: string | null;
  dueAt?: string | null;
  createdAt: string;
  closedAt?: string | null;
  orderId?: string | null;
  clientId?: string | null;
  clientIsVipSnapshot?: boolean | null;
  shortId: string;
  deliveryPhotoUrl?: string | null;
  taskNumber: number;
  sortOrder: number;
  cycleId?: string | null;
  escalatedAt?: string | null;
  estimateValue?: number | null;
  visitedStatuses?: string[];
}

export interface TasksFilter {
  boardIds?: string[];
  statuses?: string[];
  taskTypeIds?: string[];
  assigneeUserId?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  createdFrom?: string;
  createdTo?: string;
  cycleId?: string;
  backlogOnly?: boolean;
  participantUserId?: string;
}

// TasksBundleDocument fetches the board's tasks and the per-status counts
// (for kanban column headers) in a single round trip — mirrors Menu's
// OrdersBundle pattern, avoiding one poll per column.
const TasksBundleDocument = /* GraphQL */ `
  query TasksBundle($filter: ListTasksFilterInput, $pagination: DefaultFilterPaginationInput) {
    tasks(filter: $filter, pagination: $pagination) {
      rows {
        id boardId taskTypeId title description status assigneeUserId priority
        textAddress lat lng clientNameSnapshot clientPhoneSnapshot dueAt createdAt closedAt
        orderId clientId clientIsVipSnapshot shortId deliveryPhotoUrl taskNumber sortOrder cycleId
        escalatedAt estimateValue visitedStatuses
      }
      info { count }
    }
    taskStatusCounts(filter: $filter) { status count }
  }
`;

export interface TasksBundle {
  tasks: TaskItem[];
  count: number;
  statusCounts: Record<string, number>;
}

export async function tasksBundle(
  tasksToken: string,
  namespaceSlug: string,
  filter: TasksFilter = {},
  pagination: { page?: number; length?: string } = {},
): Promise<TasksBundle> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{
      tasks: { rows: TaskItem[]; info: { count: number } };
      taskStatusCounts: { status: string; count: number }[];
    }>(
      TasksBundleDocument,
      { filter, pagination: { page: pagination.page || 1, length: pagination.length || 'ONE_HUNDRED' } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return {
      tasks: res.tasks.rows,
      count: res.tasks.info.count,
      statusCounts: Object.fromEntries(res.taskStatusCounts.map((c) => [c.status, c.count])),
    };
  }, namespaceSlug);
}
