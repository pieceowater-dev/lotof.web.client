import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { useRoute } from 'vue-router';

export type AtraceShiftPatternType = 'FIXED_WEEKDAYS' | 'ROTATING';

export type AtraceShiftPattern = {
  id: string;
  name: string;
  type: AtraceShiftPatternType;
  workDaysOfWeek?: number[] | null;
  rotationWorkDays: number;
  rotationOffDays: number;
  rotationAnchorDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  lateThreshold?: string;
  earlyLeaveThreshold?: string;
  requiredHoursPerDay: number;
  comment?: string;
};

export type AtraceScheduleAssignment = {
  id: string;
  userId: string;
  shiftPatternId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  comment?: string | null;
};

function resolveNsSlug(nsSlug?: string): string {
  if (nsSlug) return nsSlug;
  try {
    const routeNs = useRoute().params.namespace;
    if (typeof routeNs === 'string' && routeNs) return routeNs;
  } catch {}
  throw new Error('Namespace slug is required');
}

async function headers(namespace: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespace, ...devHeaders };
}

const SHIFT_PATTERN_FIELDS = `
  id
  name
  type
  workDaysOfWeek
  rotationWorkDays
  rotationOffDays
  rotationAnchorDate
  shiftStartTime
  shiftEndTime
  lateThreshold
  earlyLeaveThreshold
  requiredHoursPerDay
  comment
`;

const GET_SHIFT_PATTERNS = `
  query GetShiftPatterns($filter: DefaultFilterInput!) {
    getShiftPatterns(filter: $filter) {
      patterns { ${SHIFT_PATTERN_FIELDS} }
      paginationInfo { count }
    }
  }
`;

export async function atraceGetShiftPatterns(
  search?: string,
  nsSlug?: string
): Promise<AtraceShiftPattern[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const filter: any = { pagination: { page: 1, length: 'ONE_HUNDRED' }, sort: { by: 'ASC', field: 'name' } };
    if (search) filter.search = search;
    const response = await atraceClient.request<{ getShiftPatterns: { patterns: AtraceShiftPattern[] } }>(
      GET_SHIFT_PATTERNS,
      { filter },
      { headers: await headers(namespace) }
    );
    return response.getShiftPatterns.patterns;
  }, namespace);
}

const CREATE_SHIFT_PATTERN = `
  mutation CreateShiftPattern($input: CreateShiftPatternInput!) {
    createShiftPattern(input: $input) { ${SHIFT_PATTERN_FIELDS} }
  }
`;

export async function atraceCreateShiftPattern(
  input: Omit<AtraceShiftPattern, 'id'>,
  nsSlug?: string
): Promise<AtraceShiftPattern> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ createShiftPattern: AtraceShiftPattern }>(
      CREATE_SHIFT_PATTERN,
      { input },
      { headers: await headers(namespace) }
    );
    return response.createShiftPattern;
  }, namespace);
}

const UPDATE_SHIFT_PATTERN = `
  mutation UpdateShiftPattern($input: UpdateShiftPatternInput!) {
    updateShiftPattern(input: $input) { ${SHIFT_PATTERN_FIELDS} }
  }
`;

export async function atraceUpdateShiftPattern(
  input: AtraceShiftPattern,
  nsSlug?: string
): Promise<AtraceShiftPattern> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ updateShiftPattern: AtraceShiftPattern }>(
      UPDATE_SHIFT_PATTERN,
      { input },
      { headers: await headers(namespace) }
    );
    return response.updateShiftPattern;
  }, namespace);
}

const DELETE_SHIFT_PATTERN = `
  mutation DeleteShiftPattern($id: ID!) {
    deleteShiftPattern(input: { id: $id }) { id }
  }
`;

export async function atraceDeleteShiftPattern(id: string, nsSlug?: string): Promise<void> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    await atraceClient.request(DELETE_SHIFT_PATTERN, { id }, { headers: await headers(namespace) });
  }, namespace);
}

const SCHEDULE_ASSIGNMENT_FIELDS = `
  id
  userId
  shiftPatternId
  effectiveFrom
  effectiveTo
  comment
`;

const GET_SCHEDULE_ASSIGNMENTS = `
  query GetScheduleAssignments($input: GetScheduleAssignmentsInput!) {
    getScheduleAssignments(input: $input) {
      assignments { ${SCHEDULE_ASSIGNMENT_FIELDS} }
      paginationInfo { count }
    }
  }
`;

export async function atraceGetScheduleAssignments(
  userId?: string,
  nsSlug?: string
): Promise<AtraceScheduleAssignment[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getScheduleAssignments: { assignments: AtraceScheduleAssignment[] } }>(
      GET_SCHEDULE_ASSIGNMENTS,
      { input: { userId: userId ?? null, pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: await headers(namespace) }
    );
    return response.getScheduleAssignments.assignments;
  }, namespace);
}

const GET_ACTIVE_SCHEDULE_ASSIGNMENT = `
  query GetActiveScheduleAssignment($userId: ID!, $date: String) {
    getActiveScheduleAssignment(input: { userId: $userId, date: $date }) { ${SCHEDULE_ASSIGNMENT_FIELDS} }
  }
`;

export async function atraceGetActiveScheduleAssignment(
  userId: string,
  date?: string,
  nsSlug?: string
): Promise<AtraceScheduleAssignment | null> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    try {
      const response = await atraceClient.request<{ getActiveScheduleAssignment: AtraceScheduleAssignment | null }>(
        GET_ACTIVE_SCHEDULE_ASSIGNMENT,
        { userId, date: date ?? null },
        { headers: await headers(namespace) }
      );
      return response.getActiveScheduleAssignment;
    } catch (e: any) {
      const notFound = e?.response?.errors?.some((err: any) =>
        String(err?.message || '').toLowerCase().includes('record not found')
      );
      if (notFound) return null;
      throw e;
    }
  }, namespace);
}

const ASSIGN_SCHEDULE = `
  mutation AssignSchedule($input: AssignScheduleInput!) {
    assignSchedule(input: $input) { ${SCHEDULE_ASSIGNMENT_FIELDS} }
  }
`;

export async function atraceAssignSchedule(
  userId: string,
  shiftPatternId: string,
  effectiveFrom: string,
  effectiveTo?: string,
  comment?: string,
  nsSlug?: string
): Promise<AtraceScheduleAssignment> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ assignSchedule: AtraceScheduleAssignment }>(
      ASSIGN_SCHEDULE,
      { input: { userId, shiftPatternId, effectiveFrom, effectiveTo: effectiveTo ?? null, comment: comment ?? null } },
      { headers: await headers(namespace) }
    );
    return response.assignSchedule;
  }, namespace);
}

const END_SCHEDULE_ASSIGNMENT = `
  mutation EndScheduleAssignment($id: ID!, $effectiveTo: String!) {
    endScheduleAssignment(input: { id: $id, effectiveTo: $effectiveTo }) { ${SCHEDULE_ASSIGNMENT_FIELDS} }
  }
`;

export async function atraceEndScheduleAssignment(
  id: string,
  effectiveTo: string,
  nsSlug?: string
): Promise<AtraceScheduleAssignment> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ endScheduleAssignment: AtraceScheduleAssignment }>(
      END_SCHEDULE_ASSIGNMENT,
      { id, effectiveTo },
      { headers: await headers(namespace) }
    );
    return response.endScheduleAssignment;
  }, namespace);
}
