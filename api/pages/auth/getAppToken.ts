import { pagesClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const GetAppTokenDocument = /* GraphQL */ `
  mutation GetAppToken {
    getAppToken { token }
  }
`;

export async function pagesGetAppToken(hubToken: string, namespaceSlug: string): Promise<string> {
  const devHeaders = await getDeviceHeaders();
  const res = await pagesClient.request<{ getAppToken: { token: string } }>(
    GetAppTokenDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } },
  );
  return res.getAppToken.token;
}
