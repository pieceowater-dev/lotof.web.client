import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh, resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceShiftCoverageStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AtraceShiftCoverage = {
  id: string;
  date: string;
  originalUserId: string;
  coveringUserId: string;
  status: AtraceShiftCoverageStatus;
  comment?: string | null;
  requestedByUserId: string;
};

async function headers(namespace: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespace, ...devHeaders };
}

const COVERAGE_FIELDS = `
  id
  date
  originalUserId
  coveringUserId
  status
  comment
  requestedByUserId
`;

const GET_SHIFT_COVERAGES = `
  query GetShiftCoverages($input: GetShiftCoveragesInput!) {
    getShiftCoverages(input: $input) {
      coverages { ${COVERAGE_FIELDS} }
      paginationInfo { count }
    }
  }
`;

export async function atraceGetShiftCoverages(
  userId?: string,
  startDate?: string,
  endDate?: string,
  nsSlug?: string
): Promise<AtraceShiftCoverage[]> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getShiftCoverages: { coverages: AtraceShiftCoverage[] } }>(
      GET_SHIFT_COVERAGES,
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
    return response.getShiftCoverages.coverages;
  }, namespace);
}

const REQUEST_SHIFT_COVERAGE = `
  mutation RequestShiftCoverage($input: RequestShiftCoverageInput!) {
    requestShiftCoverage(input: $input) { ${COVERAGE_FIELDS} }
  }
`;

export async function atraceRequestShiftCoverage(
  date: string,
  originalUserId: string,
  coveringUserId: string,
  comment?: string,
  nsSlug?: string
): Promise<AtraceShiftCoverage> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ requestShiftCoverage: AtraceShiftCoverage }>(
      REQUEST_SHIFT_COVERAGE,
      { input: { date, originalUserId, coveringUserId, comment: comment ?? null } },
      { headers: await headers(namespace) }
    );
    return response.requestShiftCoverage;
  }, namespace);
}

function statusMutation(name: 'approveShiftCoverage' | 'rejectShiftCoverage' | 'cancelShiftCoverage') {
  return `
    mutation ${name[0].toUpperCase()}${name.slice(1)}($id: ID!) {
      ${name}(input: { id: $id }) { ${COVERAGE_FIELDS} }
    }
  `;
}

async function setCoverageStatus(
  name: 'approveShiftCoverage' | 'rejectShiftCoverage' | 'cancelShiftCoverage',
  id: string,
  nsSlug?: string
): Promise<AtraceShiftCoverage> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<Record<string, AtraceShiftCoverage>>(
      statusMutation(name),
      { id },
      { headers: await headers(namespace) }
    );
    return response[name];
  }, namespace);
}

export const atraceApproveShiftCoverage = (id: string, nsSlug?: string) => setCoverageStatus('approveShiftCoverage', id, nsSlug);
export const atraceRejectShiftCoverage = (id: string, nsSlug?: string) => setCoverageStatus('rejectShiftCoverage', id, nsSlug);
export const atraceCancelShiftCoverage = (id: string, nsSlug?: string) => setCoverageStatus('cancelShiftCoverage', id, nsSlug);
