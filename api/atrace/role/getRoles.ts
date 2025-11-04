import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const GET_ROLES_QUERY = /* GraphQL */ `
  query GetRoles {
    getRoles {
      id
      name
      permissionIds
    }
  }
`;

export type Role = {
  id: string;
  name: string;
  permissionIds: string[];
};

export async function atraceGetRoles(
  atraceToken: string,
  namespaceSlug: string
): Promise<Role[]> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getRoles: Role[] }>(
    GET_ROLES_QUERY,
    {},
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.getRoles;
}
