import { atraceClient } from '@/api/clients';

// Use a plain GraphQL string to avoid requiring generated @gql-atrace types
const GetAppTokenDocument = /* GraphQL */ `
  mutation GetAppToken {
    getAppToken { token }
  }
`;

export async function atraceGetAppToken(hubToken: string, namespaceSlug: string): Promise<string> {
  const res = await atraceClient.request<{ getAppToken: { token: string } }>(
    GetAppTokenDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}` } }
  );
  return res.getAppToken.token;
}
