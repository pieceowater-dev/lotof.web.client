import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { RoutePass, RouteMilestoneDetail } from './validatePass';

const GET_ROUTE_PASSES = /* GraphQL */ `
  query GetRoutePasses($routeId: ID!, $userId: ID, $startDate: String, $endDate: String) {
    getRoutePasses(routeId: $routeId, userId: $userId, startDate: $startDate, endDate: $endDate) {
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

export type RoutePassListItem = RoutePass & { details: RouteMilestoneDetail[] };

export async function atraceGetRoutePasses(
  atraceToken: string,
  namespaceSlug: string,
  params: { routeId: string; userId?: string; startDate?: string; endDate?: string }
): Promise<RoutePassListItem[]> {
  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{ getRoutePasses: RoutePassListItem[] }>(
      GET_ROUTE_PASSES,
      params,
      {
        headers: {
          AtraceAuthorization: `Bearer ${atraceToken}`,
          Namespace: namespaceSlug,
          ...devHeaders,
        },
      }
    );
    return res.getRoutePasses || [];
  }, namespaceSlug);
}
