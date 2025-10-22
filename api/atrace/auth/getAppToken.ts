import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// Use a plain GraphQL string to avoid requiring generated @gql-atrace types
const GetAppTokenDocument = /* GraphQL */ `
  mutation GetAppToken {
    getAppToken { token }
  }
`;

export async function atraceGetAppToken(hubToken: string, namespaceSlug: string): Promise<string> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getAppToken: { token: string } }>(
    GetAppTokenDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } }
  );
  return res.getAppToken.token;
}
