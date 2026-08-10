import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh, resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AtraceLeaveType = 'day_off' | 'vacation';

export type AtraceLeaveRequest = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: AtraceLeaveType;
  status: AtraceLeaveStatus;
  comment?: string | null;
  requestedByUserId: string;
};

async function headers(namespace: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespace, ...devHeaders };
}

const LEAVE_FIELDS = `
  id
  userId
  startDate
  endDate
  type
  status
  comment
  requestedByUserId
`;

const GET_LEAVE_REQUESTS = `
  query GetLeaveRequests($input: GetLeaveRequestsInput!) {
    getLeaveRequests(input: $input) {
      requests { ${LEAVE_FIELDS} }
      paginationInfo { count }
    }
  }
`;

export async function atraceGetLeaveRequests(
  userId?: string,
  startDate?: string,
  endDate?: string,
  nsSlug?: string
): Promise<AtraceLeaveRequest[]> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getLeaveRequests: { requests: AtraceLeaveRequest[] } }>(
      GET_LEAVE_REQUESTS,
      {
        input: {
          userId: userId ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          pagination: { page: 1, length: 'ONE_HUNDRED' },
        },
      },
      { headers: await headers(namespace) }
    );
    return response.getLeaveRequests.requests;
  }, namespace);
}

const REQUEST_LEAVE = `
  mutation RequestLeave($input: RequestLeaveInput!) {
    requestLeave(input: $input) { ${LEAVE_FIELDS} }
  }
`;

export async function atraceRequestLeave(
  userId: string,
  startDate: string,
  endDate: string,
  type: AtraceLeaveType,
  comment?: string,
  nsSlug?: string
): Promise<AtraceLeaveRequest> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ requestLeave: AtraceLeaveRequest }>(
      REQUEST_LEAVE,
      { input: { userId, startDate, endDate, type, comment: comment ?? null } },
      { headers: await headers(namespace) }
    );
    return response.requestLeave;
  }, namespace);
}

function statusMutation(name: 'approveLeave' | 'rejectLeave' | 'cancelLeave') {
  return `
    mutation ${name[0].toUpperCase()}${name.slice(1)}($id: ID!) {
      ${name}(input: { id: $id }) { ${LEAVE_FIELDS} }
    }
  `;
}

async function setLeaveStatus(
  name: 'approveLeave' | 'rejectLeave' | 'cancelLeave',
  id: string,
  nsSlug?: string
): Promise<AtraceLeaveRequest> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<Record<string, AtraceLeaveRequest>>(
      statusMutation(name),
      { id },
      { headers: await headers(namespace) }
    );
    return response[name];
  }, namespace);
}

export const atraceApproveLeave = (id: string, nsSlug?: string) => setLeaveStatus('approveLeave', id, nsSlug);
export const atraceRejectLeave = (id: string, nsSlug?: string) => setLeaveStatus('rejectLeave', id, nsSlug);
export const atraceCancelLeave = (id: string, nsSlug?: string) => setLeaveStatus('cancelLeave', id, nsSlug);
