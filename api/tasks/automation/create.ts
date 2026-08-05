import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { AutomationRule, AutomationTriggerType, AutomationActionType } from '@/api/tasks/automation/list';

const CreateAutomationRuleDocument = /* GraphQL */ `
  mutation CreateAutomationRule($input: CreateAutomationRuleInput!) {
    createAutomationRule(input: $input) { id boardId triggerType triggerStatus actionType actionConfig isActive }
  }
`;

export interface CreateAutomationRuleInput {
  boardId: string;
  triggerType: AutomationTriggerType;
  triggerStatus?: string;
  actionType: AutomationActionType;
  actionConfig?: string;
  isActive?: boolean;
}

export async function tasksCreateAutomationRule(tasksToken: string, namespaceSlug: string, input: CreateAutomationRuleInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ createAutomationRule: AutomationRule }>(
      CreateAutomationRuleDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.createAutomationRule;
  }, namespaceSlug);
}
