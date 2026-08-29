import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh, resolveAtraceNsSlug } from '@/api/atrace/atraceRequestWithRefresh';

export type AtraceAttendanceSettings = {
  lateArrivalThreshold: string; // HH:MM
  earlyLeaveThreshold: string; // HH:MM
  allowLatenessMakeup: boolean; // "sit-out" mode: stay late to offset a late arrival
  roundingMinutes: number; // round each day's worked hours to the nearest N minutes (0 = exact)
};

const GET_ATTENDANCE_SETTINGS = `
  query GetAttendanceSettings {
    getAttendanceSettings {
      lateArrivalThreshold
      earlyLeaveThreshold
      allowLatenessMakeup
      roundingMinutes
    }
  }
`;

const UPDATE_ATTENDANCE_SETTINGS = `
  mutation UpdateAttendanceSettings($lateArrivalThreshold: String!, $earlyLeaveThreshold: String!, $allowLatenessMakeup: Boolean!, $roundingMinutes: Int!) {
    updateAttendanceSettings(input: { lateArrivalThreshold: $lateArrivalThreshold, earlyLeaveThreshold: $earlyLeaveThreshold, allowLatenessMakeup: $allowLatenessMakeup, roundingMinutes: $roundingMinutes }) {
      lateArrivalThreshold
      earlyLeaveThreshold
      allowLatenessMakeup
      roundingMinutes
    }
  }
`;

export async function atraceGetAttendanceSettings(nsSlug?: string): Promise<AtraceAttendanceSettings> {
  const namespace = resolveAtraceNsSlug(nsSlug);
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
  roundingMinutes: number,
  nsSlug?: string
): Promise<AtraceAttendanceSettings> {
  const namespace = resolveAtraceNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const devHeaders = await getDeviceHeaders();
    const response = await atraceClient.request<{ updateAttendanceSettings: AtraceAttendanceSettings }>(
      UPDATE_ATTENDANCE_SETTINGS,
      { lateArrivalThreshold, earlyLeaveThreshold, allowLatenessMakeup, roundingMinutes },
      { headers: { Namespace: namespace, ...devHeaders } }
    );
    return response.updateAttendanceSettings;
  }, namespace);
}
