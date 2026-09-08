import { plansClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// Plain GraphQL string — no generated @gql-plans types needed for the one
// bootstrap call.
const GetAppTokenDocument = /* GraphQL */ `
  mutation GetAppToken {
    getAppToken { token }
  }
`;

export async function plansGetAppToken(hubToken: string, namespaceSlug: string): Promise<string> {
  const devHeaders = await getDeviceHeaders();
  const res = await plansClient.request<{ getAppToken: { token: string } }>(
    GetAppTokenDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } },
  );
  return res.getAppToken.token;
}
