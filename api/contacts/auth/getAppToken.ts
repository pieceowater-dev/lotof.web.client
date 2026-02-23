import { contactsClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

// Use a plain GraphQL string to avoid requiring generated types
const GetAppTokenDocument = /* GraphQL */ `
  mutation GetAppToken {
    getAppToken { token }
  }
`;

export async function contactsGetAppToken(hubToken: string, namespaceSlug: string): Promise<string> {
  const devHeaders = await getDeviceHeaders();
  const res = await contactsClient.request<{ getAppToken: { token: string } }>(
    GetAppTokenDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } }
  );
  return res.getAppToken.token;
}
