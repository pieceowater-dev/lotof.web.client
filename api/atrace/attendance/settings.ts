import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { useRoute } from 'vue-router';

export type AtraceAttendanceSettings = {
  lateArrivalThreshold: string; // HH:MM
  earlyLeaveThreshold: string; // HH:MM
  allowLatenessMakeup: boolean; // "sit-out" mode: stay late to offset a late arrival
};

const GET_ATTENDANCE_SETTINGS = `
  query GetAttendanceSettings {
    getAttendanceSettings {
      lateArrivalThreshold
      earlyLeaveThreshold
      allowLatenessMakeup
    }
  }
`;

const UPDATE_ATTENDANCE_SETTINGS = `
  mutation UpdateAttendanceSettings($lateArrivalThreshold: String!, $earlyLeaveThreshold: String!, $allowLatenessMakeup: Boolean!) {
    updateAttendanceSettings(input: { lateArrivalThreshold: $lateArrivalThreshold, earlyLeaveThreshold: $earlyLeaveThreshold, allowLatenessMakeup: $allowLatenessMakeup }) {
      lateArrivalThreshold
      earlyLeaveThreshold
      allowLatenessMakeup
    }
  }
`;

function resolveNsSlug(nsSlug?: string): string {
  if (nsSlug) return nsSlug;
  try {
    const routeNs = useRoute().params.namespace;
    if (typeof routeNs === 'string' && routeNs) {
      return routeNs;
    }
  } catch {}
  throw new Error('Namespace slug is required');
}

export async function atraceGetAttendanceSettings(nsSlug?: string): Promise<AtraceAttendanceSettings> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ getAttendanceSettings: AtraceAttendanceSettings }>(
      GET_ATTENDANCE_SETTINGS,
      {},
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.getAttendanceSettings;
  }, namespace);
}

export async function atraceUpdateAttendanceSettings(
  lateArrivalThreshold: string,
  earlyLeaveThreshold: string,
  allowLatenessMakeup: boolean,
  nsSlug?: string
): Promise<AtraceAttendanceSettings> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ updateAttendanceSettings: AtraceAttendanceSettings }>(
      UPDATE_ATTENDANCE_SETTINGS,
      { lateArrivalThreshold, earlyLeaveThreshold, allowLatenessMakeup },
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.updateAttendanceSettings;
  }, namespace);
}
