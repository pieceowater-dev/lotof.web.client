import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

const ASSIGN_ROLE_MUTATION = /* GraphQL */ `
  mutation AssignRoleToMember($input: AssignRoleToMemberInput!) {
    assignRoleToMember(input: $input)
  }
`;

const REMOVE_ROLE_MUTATION = /* GraphQL */ `
  mutation RemoveRoleFromMember($input: RemoveRoleFromMemberInput!) {
    removeRoleFromMember(input: $input)
  }
`;

export async function atraceAssignRole(
  atraceToken: string,
  namespaceSlug: string,
  roleId: string,
  memberId: string
): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ assignRoleToMember: boolean }>(
    ASSIGN_ROLE_MUTATION,
    {
      input: { roleId, memberId }
    },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.assignRoleToMember;
}

export async function atraceRemoveRole(
  atraceToken: string,
  namespaceSlug: string,
  roleId: string,
  memberId: string
): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  const res = await atraceClient.request<{ removeRoleFromMember: boolean }>(
    REMOVE_ROLE_MUTATION,
    {
      input: { roleId, memberId }
    },
    {
      headers: {
        AtraceAuthorization: `Bearer ${atraceToken}`,
        Namespace: namespaceSlug,
        ...devHeaders,
      }
    }
  );
  return res.removeRoleFromMember;
}
