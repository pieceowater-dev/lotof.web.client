import { atraceClient } from '@/api/clients';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { Route } from './list';

const DELETE_ROUTE = /* GraphQL */ `
  mutation DeleteRoute($id: ID!) {
    deleteRoute(id: $id) {
      id
      title
      milestones { postId priority }
    }
  }
`;

export async function atraceDeleteRoute(
  atraceToken: string,
  namespaceSlug: string,
  id: string
): Promise<Route> {
  const devHeaders = await getDeviceHeaders();
  return atraceRequestWithRefresh(async () => {
    const res = await atraceClient.request<{ deleteRoute: Route }>(DELETE_ROUTE, { id }, {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    });
    return res.deleteRoute;
  }, namespaceSlug);
}
