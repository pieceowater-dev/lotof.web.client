import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type AutomationTriggerType = 'UNSPECIFIED' | 'TASK_STATUS_CHANGED' | 'TASK_CREATED' | 'TASK_ASSIGNED';
export type AutomationActionType = 'UNSPECIFIED' | 'UPDATE_ORDER_STATUS' | 'NOTIFY_CLIENT' | 'CREATE_TASK';

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: AutomationTriggerType;
  triggerStatus: string;
  actionType: AutomationActionType;
  actionConfig: string;
  isActive: boolean;
}

const AutomationRulesDocument = /* GraphQL */ `
  query AutomationRules($boardId: ID!, $filter: DefaultFilterInput) {
    automationRules(boardId: $boardId, filter: $filter) {
      rows { id boardId triggerType triggerStatus actionType actionConfig isActive }
      info { count }
    }
  }
`;

export async function tasksAutomationRulesList(tasksToken: string, namespaceSlug: string, boardId: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ automationRules: { rows: AutomationRule[]; info: { count: number } } }>(
      AutomationRulesDocument,
      { boardId, filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return { rules: res.automationRules.rows, count: res.automationRules.info.count };
  }, namespaceSlug);
}
