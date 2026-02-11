import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { Route } from './list';
import type { RoutePass, RouteMilestoneDetail } from './validatePass';

const ROUTE_BUNDLE_QUERY = /* GraphQL */ `
  query RouteBundle(
    $routesFilter: DefaultFilterInput!
    $routeId: ID!
    $passesUserId: ID
    $startDate: String
    $endDate: String
    $validateUserId: ID!
    $validateDate: String!
    $includeValidation: Boolean!
  ) {
    getRoutes(filter: $routesFilter) {
      routes {
        id
        title
        milestones { postId priority }
      }
      paginationInfo { count }
    }
    getRoutePasses(routeId: $routeId, userId: $passesUserId, startDate: $startDate, endDate: $endDate) {
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
    validateRoutePass(routeId: $routeId, userId: $validateUserId, date: $validateDate) @include(if: $includeValidation) {
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

export type RouteBundleResult = {
  routes: Route[];
  count: number;
  passes: RoutePassListItem[];
  validation: RoutePass | null;
};

export async function atraceGetRouteBundle(
  atraceToken: string,
  namespaceSlug: string,
  params: {
    routes: { search?: string; page?: number; length?: 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'ONE_HUNDRED' };
    routeId: string;
    passesUserId?: string;
    startDate?: string;
    endDate?: string;
    validateUserId: string;
    validateDate: string;
    includeValidation: boolean;
  }
): Promise<RouteBundleResult> {
  const filter: any = {
    pagination: { page: params.routes.page ?? 1, length: params.routes.length ?? 'ONE_HUNDRED' },
    sort: { by: 'ASC', field: 'title' },
  };
  if (params.routes.search) filter.search = params.routes.search;

  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{
      getRoutes: { routes: Route[]; paginationInfo: { count: number } };
      getRoutePasses: RoutePassListItem[];
      validateRoutePass: RoutePass | null;
    }>(
      ROUTE_BUNDLE_QUERY,
      {
        routesFilter: filter,
        routeId: params.routeId,
        passesUserId: params.passesUserId,
        startDate: params.startDate,
        endDate: params.endDate,
        validateUserId: params.validateUserId,
        validateDate: params.validateDate,
        includeValidation: params.includeValidation,
      },
      {
        headers: {
          AtraceAuthorization: `Bearer ${atraceToken}`,
          Namespace: namespaceSlug,
          ...devHeaders,
        },
      }
    );

    return {
      routes: res.getRoutes.routes,
      count: res.getRoutes.paginationInfo.count,
      passes: res.getRoutePasses || [],
      validation: res.validateRoutePass ?? null,
    };
  }, namespaceSlug);
}
