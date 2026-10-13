import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import { getApiBaseUrl } from '@/utils/api-base';
import { toStoredMediaPath } from '@/utils/mediaUrl';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { assertUploadSize } from '@/utils/imageCompression';
import type { TaskItem } from '@/api/tasks/task/list';

// Comments with photos, problem reports, hand-over acceptance and the daily
// report of a board.

export type TaskAttachment = { url: string; name: string; mime: string; sizeBytes: number; kind: 'PHOTO' | 'DOCUMENT' | string };
export type TaskComment = {
  id: string;
  taskId: string;
  authorId?: string | null;
  body: string;
  important: boolean;
  pinned: boolean;
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};
export type DailyReportRow = { assigneeUserId?: string | null; assigned: number; done: number; postponed: number; cancelled: number; overdue: number; avgDoneMinutes: number };

const TASK_FIELDS = `
  id boardId taskTypeId title description status assigneeUserId priority
  textAddress lat lng clientNameSnapshot clientPhoneSnapshot dueAt createdAt closedAt
  orderId clientId clientIsVipSnapshot shortId deliveryPhotoUrl taskNumber sortOrder cycleId
  escalatedAt estimateValue visitedStatuses dealAmount dealCurrency collectAmount courierFee courierKind previousAssigneeUserId
  dueFrom problemReportedAt problemReason pendingAssigneeUserId pendingFromUserId
`;
const COMMENT_FIELDS = 'id taskId authorId body important pinned createdAt updatedAt deleted attachments { url name mime sizeBytes kind }';

async function call<T>(token: string, ns: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(
    () => tasksClient.request<T>(query as any, variables, { headers: { IssuesAuthorization: `Bearer ${token}`, Namespace: ns, ...devHeaders } }),
    ns,
  );
}

export async function tasksComments(token: string, ns: string, taskId: string): Promise<TaskComment[]> {
  const r = await call<{ taskComments: TaskComment[] }>(token, ns, `query TaskComments($taskId: ID!) { taskComments(taskId: $taskId) { ${COMMENT_FIELDS} } }`, { taskId });
  return r.taskComments;
}

export async function tasksCreateComment(token: string, ns: string, input: { taskId: string; body: string; important?: boolean; pinned?: boolean; attachments?: Array<{ url: string; name?: string; mime?: string; sizeBytes?: number; kind?: string }> }): Promise<TaskComment> {
  const r = await call<{ createTaskComment: TaskComment }>(token, ns, `mutation CommentCreate($taskId: ID!, $body: String!, $important: Boolean, $pinned: Boolean, $attachments: [TaskAttachmentInput!]) { createTaskComment(taskId: $taskId, body: $body, important: $important, pinned: $pinned, attachments: $attachments) { ${COMMENT_FIELDS} } }`, input);
  return r.createTaskComment;
}

export async function tasksUpdateComment(token: string, ns: string, input: { commentId: string; body: string; important?: boolean; pinned?: boolean }): Promise<TaskComment> {
  const r = await call<{ updateTaskComment: TaskComment }>(token, ns, `mutation CommentUpdate($commentId: ID!, $body: String!, $important: Boolean, $pinned: Boolean) { updateTaskComment(commentId: $commentId, body: $body, important: $important, pinned: $pinned) { ${COMMENT_FIELDS} } }`, input);
  return r.updateTaskComment;
}

export async function tasksDeleteComment(token: string, ns: string, commentId: string, restore = false): Promise<TaskComment> {
  const r = await call<{ deleteTaskComment: TaskComment }>(token, ns, `mutation CommentDelete($commentId: ID!, $restore: Boolean) { deleteTaskComment(commentId: $commentId, restore: $restore) { ${COMMENT_FIELDS} } }`, { commentId, restore });
  return r.deleteTaskComment;
}

export async function tasksReportProblem(token: string, ns: string, input: { taskId: string; reasonCode: string; text?: string; moveToStatus?: string }): Promise<TaskItem> {
  const r = await call<{ reportProblem: TaskItem }>(token, ns, `mutation Problem($taskId: ID!, $reasonCode: String!, $text: String, $moveToStatus: String) { reportProblem(taskId: $taskId, reasonCode: $reasonCode, text: $text, moveToStatus: $moveToStatus) { ${TASK_FIELDS} } }`, input);
  return r.reportProblem;
}

export async function tasksClearProblem(token: string, ns: string, taskId: string): Promise<TaskItem> {
  const r = await call<{ clearProblem: TaskItem }>(token, ns, `mutation ProblemClear($taskId: ID!) { clearProblem(taskId: $taskId) { ${TASK_FIELDS} } }`, { taskId });
  return r.clearProblem;
}

export async function tasksResolveHandoff(token: string, ns: string, taskId: string, accept: boolean): Promise<TaskItem> {
  const q = accept
    ? `mutation HandoffAccept($taskId: ID!) { acceptHandoff(taskId: $taskId) { ${TASK_FIELDS} } }`
    : `mutation HandoffDecline($taskId: ID!) { declineHandoff(taskId: $taskId) { ${TASK_FIELDS} } }`;
  const r = await call<{ acceptHandoff?: TaskItem; declineHandoff?: TaskItem }>(token, ns, q, { taskId });
  return (r.acceptHandoff || r.declineHandoff) as TaskItem;
}

export async function tasksDailyReport(token: string, ns: string, input: { boardId: string; from: string; to: string; doneKeys: string[]; postponedKeys: string[]; cancelledKeys: string[] }): Promise<DailyReportRow[]> {
  const r = await call<{ boardDailyReport: DailyReportRow[] }>(token, ns, `query DailyReport($boardId: ID!, $from: String!, $to: String!, $doneKeys: [String!], $postponedKeys: [String!], $cancelledKeys: [String!]) { boardDailyReport(boardId: $boardId, from: $from, to: $to, doneKeys: $doneKeys, postponedKeys: $postponedKeys, cancelledKeys: $cancelledKeys) { assigneeUserId assigned done postponed cancelled overdue avgDoneMinutes } }`, input);
  return r.boardDailyReport;
}

export async function tasksUploadImage(token: string, ns: string, file: File): Promise<{ url: string; contentType: string; size: number }> {
  assertUploadSize(file);
  const operations = { query: 'mutation UploadIssuesImage($file: Upload!) { uploadIssuesImage(file: $file) { url contentType size } }', variables: { file: null } };
  const { body, contentType } = await buildGraphqlUploadBody(operations, { file: ['variables.file'] }, 'file', file);
  const devHeaders = await getDeviceHeaders();
  const response = await fetch(`${getApiBaseUrl('tasks')}/query`, {
    method: 'POST',
    headers: { IssuesAuthorization: `Bearer ${token}`, Namespace: ns, 'Content-Type': contentType, ...devHeaders },
    body,
  });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.errors?.length) throw new Error(String(result?.errors?.[0]?.message || `Upload failed with status ${response.status}`));
  const p = result?.data?.uploadIssuesImage;
  if (!p?.url) throw new Error('Upload did not return an image URL');
  return { url: toStoredMediaPath('tasks', p.url), contentType: p.contentType, size: p.size };
}
