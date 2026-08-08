import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// Plain GraphQL string, matching getAppToken.ts -- avoids requiring generated @gql-atrace types.
const GetMyPermissionsDocument = /* GraphQL */ `
  query GetMyPermissions {
    getMyPermissions
  }
`;

export async function atraceGetMyPermissions(atraceToken: string, namespaceSlug: string): Promise<string[]> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getMyPermissions: string[] }>(
    GetMyPermissionsDocument,
    {},
    { headers: { AtraceAuthorization: `Bearer ${atraceToken}`, Namespace: namespaceSlug, ...devHeaders } }
  );
  return res.getMyPermissions || [];
}
