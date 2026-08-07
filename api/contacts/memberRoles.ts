import { contactsClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';

export type ContactsMemberAccessRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type ContactsMemberRoleInfo = {
  userId: string;
  role: ContactsMemberAccessRole;
};

// Plain GraphQL strings (not generated types) -- matches every other
// call site in api/contacts/auth/, since these are @hubAuth (raw hub
// token), not a Contacts app token.
const ListMemberRolesDocument = /* GraphQL */ `
  query ContactsMemberRoles {
    contactsMemberRoles { userId role }
  }
`;

const SetMemberRoleDocument = /* GraphQL */ `
  mutation ContactsSetMemberRole($userId: ID!, $role: MemberAccessRole!) {
    contactsSetMemberRole(userId: $userId, role: $role) { userId role }
  }
`;

export async function contactsListMemberRoles(hubToken: string, namespaceSlug: string): Promise<ContactsMemberRoleInfo[]> {
  const devHeaders = await getDeviceHeaders();
  const res = await contactsClient.request<{ contactsMemberRoles: ContactsMemberRoleInfo[] }>(
    ListMemberRolesDocument,
    {},
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } }
  );
  return res.contactsMemberRoles ?? [];
}

export async function contactsSetMemberRole(
  hubToken: string,
  namespaceSlug: string,
  userId: string,
  role: ContactsMemberAccessRole,
): Promise<ContactsMemberRoleInfo> {
  const devHeaders = await getDeviceHeaders();
  const res = await contactsClient.request<{ contactsSetMemberRole: ContactsMemberRoleInfo }>(
    SetMemberRoleDocument,
    { userId, role },
    { headers: { Namespace: namespaceSlug, Authorization: `Bearer ${hubToken}`, ...devHeaders } }
  );
  return res.contactsSetMemberRole;
}
