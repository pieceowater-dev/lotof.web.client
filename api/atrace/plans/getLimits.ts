import { atraceClient } from '@/api/clients';
import { CookieKeys } from '@/utils/storageKeys';

export interface PlanLimits {
  limitsJson: string;
  planCode: string;
  planName: string;
}

const GetPlanLimitsDocument = /* GraphQL */ `
  query GetPlanLimits($appBundle: String!) {
    getPlanLimits(appBundle: $appBundle) {
      limitsJson
      planCode
      planName
    }
  }
`;

export async function getPlanLimits(
  namespaceSlug: string,
  appBundle: string = 'pieceowater.atrace',
  hubToken?: string | null
): Promise<PlanLimits | null> {
  const resolvedHubToken = hubToken ?? useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  const atraceToken = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value;
  const headers: Record<string, string> = {
    Namespace: namespaceSlug,
  };
  if (resolvedHubToken) {
    headers.Authorization = `Bearer ${resolvedHubToken}`;
  }
  if (atraceToken) {
    headers.AtraceAuthorization = `Bearer ${atraceToken}`;
  }

  try {
    const res = await atraceClient.request<{
      getPlanLimits: PlanLimits | null
    }>(GetPlanLimitsDocument, { appBundle }, {
      headers,
    });

    return res.getPlanLimits;
  } catch (error) {
    console.error('Failed to get plan limits:', error);
    throw error;
  }
}
