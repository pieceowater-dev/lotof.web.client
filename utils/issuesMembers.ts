import { FilterPaginationLengthEnum } from '@gql-hub';
import { memberDisplayNameWithFallback } from '@/utils/memberDisplayName';

// Assignee/watcher/filter dropdowns should only offer namespace members who
// have actually been granted an Issues role (staff.list) -- otherwise every
// Hub member shows up, including people who have never touched Issues and
// couldn't do anything with a task if assigned one.
export async function loadIssuesStaffMemberOptions(
  hubToken: string,
  tasksToken: string,
  nsSlug: string,
): Promise<{ label: string; value: string }[]> {
  const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
  const { hubMembersList } = await import('@/api/hub/members/list');
  const { tasksStaffList } = await import('@/api/tasks/staff/list');

  const namespace = await hubNamespaceBySlug(hubToken, nsSlug);
  if (!namespace?.id) return [];

  const collected: Array<{ userId: string; username: string; email: string; nickname?: string | null }> = [];
  let page = 1;
  let batch: Array<{ userId: string; username: string; email: string; nickname?: string | null }>;
  do {
    batch = await hubMembersList(hubToken, namespace.id, page, FilterPaginationLengthEnum.Fifty);
    collected.push(...batch);
    page += 1;
  } while (batch.length >= 50);

  const { staff } = await tasksStaffList(tasksToken, nsSlug);
  const staffUserIds = new Set(staff.map((s) => s.userId));

  return collected
    .filter((m) => staffUserIds.has(m.userId))
    .map((m) => ({ label: memberDisplayNameWithFallback(m, m.email), value: m.userId }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
