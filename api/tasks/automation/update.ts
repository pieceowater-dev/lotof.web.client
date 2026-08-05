import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { AutomationRule, AutomationTriggerType, AutomationActionType } from '@/api/tasks/automation/list';

const UpdateAutomationRuleDocument = /* GraphQL */ `
  mutation UpdateAutomationRule($input: UpdateAutomationRuleInput!) {
    updateAutomationRule(input: $input) { id boardId triggerType triggerStatus actionType actionConfig isActive }
  }
`;

export interface UpdateAutomationRuleInput {
  id: string;
  triggerType: AutomationTriggerType;
  triggerStatus?: string;
  actionType: AutomationActionType;
  actionConfig?: string;
  isActive?: boolean;
}

export async function tasksUpdateAutomationRule(tasksToken: string, namespaceSlug: string, input: UpdateAutomationRuleInput) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateAutomationRule: AutomationRule }>(
      UpdateAutomationRuleDocument,
      { input },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateAutomationRule;
  }, namespaceSlug);
}
