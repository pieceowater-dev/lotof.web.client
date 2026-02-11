import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const VALIDATE_ROUTE_PASS = /* GraphQL */ `
  query ValidateRoutePass($routeId: ID!, $userId: ID!, $date: String!) {
    validateRoutePass(routeId: $routeId, userId: $userId, date: $date) {
      id
      routeId
      userId
      date
      status
      firstRecordId
      lastRecordId
      processedAt
      details {
        postId
        priority
        recordId
        timestamp
        isCorrectOrder
      }
    }
  }
`;

export type RouteMilestoneDetail = {
  postId: string;
  priority: number;
  recordId?: string | null;
  timestamp?: string | null;
  isCorrectOrder: boolean;
};

export type RoutePass = {
  id: string;
  routeId: string;
  userId: string;
  date: string;
  status: 'completed' | 'violated' | 'partial' | 'pending' | string;
  firstRecordId?: string | null;
  lastRecordId?: string | null;
  processedAt?: string | null;
  details: RouteMilestoneDetail[];
};

export async function atraceValidateRoutePass(
  atraceToken: string,
  namespaceSlug: string,
  params: { routeId: string; userId: string; date: string }
): Promise<RoutePass | null> {
  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{ validateRoutePass: RoutePass | null }>(
      VALIDATE_ROUTE_PASS,
      params,
      {
        headers: {
          AtraceAuthorization: `Bearer ${atraceToken}`,
          Namespace: namespaceSlug,
          ...devHeaders,
        },
      }
    );
    return res.validateRoutePass;
  }, namespaceSlug);
}
