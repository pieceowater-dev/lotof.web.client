import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteAutomationRuleDocument = /* GraphQL */ `
  mutation DeleteAutomationRule($id: ID!) {
    deleteAutomationRule(id: $id) { success }
  }
`;

export async function tasksDeleteAutomationRule(tasksToken: string, namespaceSlug: string, id: string) {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ deleteAutomationRule: { success: boolean } }>(
      DeleteAutomationRuleDocument,
      { id },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.deleteAutomationRule.success;
  }, namespaceSlug);
}
