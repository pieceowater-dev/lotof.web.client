import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { Route, RouteMilestone } from './list';

const CREATE_ROUTE = /* GraphQL */ `
  mutation CreateRoute($input: CreateRouteInput!) {
    createRoute(input: $input) {
      id
      title
      milestones { postId priority }
    }
  }
`;

export async function atraceCreateRoute(
  atraceToken: string,
  namespaceSlug: string,
  input: { title: string; milestones: RouteMilestone[] }
): Promise<Route> {
  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{ createRoute: Route }>(CREATE_ROUTE, { input }, {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    });
    return res.createRoute;
  }, namespaceSlug);
}
