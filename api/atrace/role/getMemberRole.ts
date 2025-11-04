import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const GET_MEMBER_ROLE_QUERY = /* GraphQL */ `
  query GetMemberRole($memberId: ID!) {
    getMemberRole(memberId: $memberId) {
      id
      name
      permissionIds
    }
  }
`;

export type MemberRole = {
  id: string;
  name: string;
  permissionIds: string[];
} | null;

export async function atraceGetMemberRole(
  atraceToken: string,
  namespaceSlug: string,
  memberId: string
): Promise<MemberRole> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ getMemberRole: MemberRole }>(
    GET_MEMBER_ROLE_QUERY,
    { memberId },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.getMemberRole;
}
